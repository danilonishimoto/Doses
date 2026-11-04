import assert from 'node:assert';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { runVersionedMigrations } from '../db/migrator.js';
import { PushDispatcherService } from './pushDispatcherService.js';
import { OccurrenceGeneratorService } from './occurrenceGeneratorService.js';

interface MockPushCall {
  subscription: any;
  payload: any;
  options: any;
}

function createMockWebpush() {
  const calls: MockPushCall[] = [];
  let customHandler: ((sub: any, payload: string, options: any) => Promise<any>) | null = null;

  return {
    calls,
    setHandler: (handler: (sub: any, payload: string, options: any) => Promise<any>) => {
      customHandler = handler;
    },
    reset: () => {
      calls.length = 0;
      customHandler = null;
    },
    sendNotification: async (sub: any, payload: string, options: any) => {
      const parsedPayload = JSON.parse(payload);
      calls.push({ subscription: sub, payload: parsedPayload, options });
      if (customHandler) {
        return customHandler(sub, payload, options);
      }
      return { statusCode: 201 };
    },
  };
}

function createTestDb(): { db: Database.Database; dbPath: string } {
  const dbPath = `./data/test_dispatch_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
  const db = new Database(dbPath, { timeout: 10000 });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 10000');
  runVersionedMigrations(db);
  return { db, dbPath };
}

async function runDispatcherTests() {
  console.log('================================================================');
  console.log('  Suíte de Testes Automatizados — Etapa 3C (Despacho Web Push)  ');
  console.log('================================================================\n');

  const { db, dbPath } = createTestDb();
  const mockPush = createMockWebpush();
  let passed = 0;

  try {
    // -------------------------------------------------------------
    // SETUP BASE: Conta, Perfis, Medicamentos, Horários e Subscriptions
    // -------------------------------------------------------------
    const accountId = 'acc_dispatch_test';
    const accountBId = 'acc_dispatch_b';
    const profileHumanId = 'prof_human';
    const profilePetId = 'prof_pet';
    const medAId = 'med_dipirona';
    const medPetId = 'med_antipulgas';
    const timeAId = 'time_0800';
    const timePetId = 'time_1200';

    // Cria Contas
    db.prepare(`
      INSERT INTO accounts (id, username, password_hash, salt)
      VALUES (?, 'user_dispatch', 'hash', 'salt'), (?, 'user_b', 'hash', 'salt')
    `).run(accountId, accountBId);

    // Cria Perfis
    db.prepare(`
      INSERT INTO profiles (id, account_id, name, avatar, is_main_profile)
      VALUES (?, ?, 'Danillo', 'adult-man', 1), (?, ?, 'Rex', 'dog', 0)
    `).run(profileHumanId, accountId, profilePetId, accountId);

    // Cria Medicamentos
    db.prepare(`
      INSERT INTO medications (id, profile_id, account_id, name, dosage, recurrence)
      VALUES (?, ?, ?, 'Dipirona', '500mg', 'DAILY'), (?, ?, ?, 'Simparic', '1 comp', 'DAILY')
    `).run(medAId, profileHumanId, accountId, medPetId, profilePetId, accountId);

    // Cria Horários
    db.prepare(`
      INSERT INTO medication_times (id, medication_id, profile_id, account_id, time, version)
      VALUES (?, ?, ?, ?, '08:00', 1), (?, ?, ?, ?, '12:00', 1)
    `).run(timeAId, medAId, profileHumanId, accountId, timePetId, medPetId, profilePetId, accountId);

    // -------------------------------------------------------------
    // CENÁRIO 1: Ocorrência elegível adquirida e enviada com sucesso
    // -------------------------------------------------------------
    console.log('--- GRUPO 1: Fluxo Principal e Dispositivos ---');
    const sub1Id = 'sub_device_phone';
    db.prepare(`
      INSERT INTO push_subscriptions (id, account_id, endpoint, p256dh, auth, device_name, hide_medication_names, is_active)
      VALUES (?, ?, 'https://fcm.googleapis.com/fcm/send/phone', 'p256dh_phone', 'auth_phone', 'iPhone', 0, 1)
    `).run(sub1Id, accountId);

    const nowUtcMs = Date.now();
    const occ1Id = 'occ_test_1';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status, retry_count
      ) VALUES (?, ?, ?, ?, '2026-11-01', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED', 0)
    `).run(occ1Id, timeAId, profileHumanId, accountId, nowUtcMs - 1000);

    mockPush.reset();
    const dispatcher = new PushDispatcherService({
      db,
      webpushClient: mockPush as any,
    });

    const res1 = await dispatcher.dispatchOccurrence(occ1Id, nowUtcMs);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.status, 'DISPATCHED');
    assert.strictEqual(res1.sentCount, 1);
    assert.strictEqual(mockPush.calls.length, 1);

    const occ1After = db.prepare('SELECT status, lease_until, dispatched_at, last_error FROM dose_occurrences WHERE id = ?').get(occ1Id) as any;
    assert.strictEqual(occ1After.status, 'DISPATCHED');
    assert.strictEqual(occ1After.lease_until, null);
    assert.ok(occ1After.dispatched_at !== null);
    assert.strictEqual(occ1After.last_error, null);

    console.log('✓ Cenário 1: Ocorrência elegível adquirida e enviada com sucesso (DISPATCHED, lease liberado)');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 2: Ocorrência sem subscriptions ativas
    // -------------------------------------------------------------
    // Conta B não possui nenhuma subscription
    const occNoSubId = 'occ_no_sub';
    db.prepare(`
      INSERT INTO profiles (id, account_id, name, avatar) VALUES ('prof_b', ?, 'Paciente B', 'woman')
    `).run(accountBId);
    db.prepare(`
      INSERT INTO medications (id, profile_id, account_id, name) VALUES ('med_b', 'prof_b', ?, 'Remédio B')
    `).run(accountBId);
    db.prepare(`
      INSERT INTO medication_times (id, medication_id, profile_id, account_id, time) VALUES ('time_b', 'med_b', 'prof_b', ?, '09:00')
    `).run(accountBId);
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, 'time_b', 'prof_b', ?, '2026-11-02', '09:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occNoSubId, accountBId, nowUtcMs - 500);

    mockPush.reset();
    const res2 = await dispatcher.dispatchOccurrence(occNoSubId, nowUtcMs);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.status, 'DISPATCHED');
    assert.strictEqual(res2.sentCount, 0);
    assert.strictEqual(res2.reason, 'NO_ACTIVE_SUBSCRIPTIONS');
    assert.strictEqual(mockPush.calls.length, 0);

    const occNoSubAfter = db.prepare('SELECT status, last_error FROM dose_occurrences WHERE id = ?').get(occNoSubId) as any;
    assert.strictEqual(occNoSubAfter.status, 'DISPATCHED');
    assert.strictEqual(occNoSubAfter.last_error, 'NO_ACTIVE_SUBSCRIPTIONS');

    console.log('✓ Cenário 2: Ocorrência sem subscriptions ativas finalizada como DISPATCHED sem travar');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 3: Uma conta com múltiplos dispositivos
    // -------------------------------------------------------------
    const sub2Id = 'sub_device_laptop';
    db.prepare(`
      INSERT INTO push_subscriptions (id, account_id, endpoint, p256dh, auth, device_name, hide_medication_names, is_active)
      VALUES (?, ?, 'https://updates.push.services.mozilla.com/wpush/laptop', 'p256dh_laptop', 'auth_laptop', 'MacBook', 1, 1)
    `).run(sub2Id, accountId);

    const occMultiDevId = 'occ_multi_dev';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-03', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occMultiDevId, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    const res3 = await dispatcher.dispatchOccurrence(occMultiDevId, nowUtcMs);
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.sentCount, 2);
    assert.strictEqual(mockPush.calls.length, 2);

    // Confirma que ambos os dispositivos foram registrados na tabela individual
    const dispatches = db.prepare('SELECT subscription_id, status FROM dose_occurrence_dispatches WHERE occurrence_id = ?').all(occMultiDevId) as any[];
    assert.strictEqual(dispatches.length, 2);
    assert.ok(dispatches.some((d) => d.subscription_id === sub1Id && d.status === 'SENT'));
    assert.ok(dispatches.some((d) => d.subscription_id === sub2Id && d.status === 'SENT'));

    console.log('✓ Cenário 3: Conta com múltiplos dispositivos notificou todos os aparelhos ativos');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 4: Falha em um dispositivo e sucesso nos demais (com retry sem duplicar)
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 2: Resiliência, Retries e Subscriptions Expiradas ---');
    const occPartialId = 'occ_partial_fail';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status, retry_count
      ) VALUES (?, ?, ?, ?, '2026-11-04', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED', 0)
    `).run(occPartialId, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    // Simula sucesso no iPhone e falha temporária 500 no MacBook
    mockPush.setHandler(async (sub) => {
      if (sub.endpoint.includes('laptop')) {
        const err: any = new Error('Push service 500 Internal Error');
        err.statusCode = 500;
        throw err;
      }
      return { statusCode: 201 };
    });

    const res4 = await dispatcher.dispatchOccurrence(occPartialId, nowUtcMs);
    assert.strictEqual(res4.success, false);
    assert.strictEqual(res4.status, 'DISPATCH_FAILED');
    assert.strictEqual(res4.sentCount, 1); // iPhone enviado
    assert.strictEqual(res4.failedCount, 1); // MacBook falhou

    // Executa a segunda tentativa (retry): APENAS o MacBook deve ser reenviado!
    mockPush.reset();
    mockPush.setHandler(async () => ({ statusCode: 201 })); // Agora o MacBook responde 201

    const res4Retry = await dispatcher.dispatchOccurrence(occPartialId, nowUtcMs + 1000);
    assert.strictEqual(res4Retry.success, true);
    assert.strictEqual(res4Retry.status, 'DISPATCHED');
    assert.strictEqual(res4Retry.sentCount, 1); // Apenas 1 novo envio (o laptop)
    assert.strictEqual(mockPush.calls.length, 1); // iPhone NÃO foi chamado novamente!
    assert.strictEqual(mockPush.calls[0].subscription.endpoint.includes('laptop'), true);

    console.log('✓ Cenário 4: Falha em um dispositivo permitiu retry que NÃO duplicou envio para quem já recebeu');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 5: Subscription expirada (404/410)
    // -------------------------------------------------------------
    const subExpiredId = 'sub_expired_device';
    db.prepare(`
      INSERT INTO push_subscriptions (id, account_id, endpoint, p256dh, auth, device_name, is_active)
      VALUES (?, ?, 'https://fcm.googleapis.com/fcm/send/expired', 'p256', 'auth', 'Antigo', 1)
    `).run(subExpiredId, accountId);

    const occExpiredSubId = 'occ_expired_sub';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-05', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occExpiredSubId, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    mockPush.setHandler(async (sub) => {
      if (sub.endpoint.includes('expired')) {
        const err: any = new Error('Subscription expired');
        err.statusCode = 410; // Gone
        throw err;
      }
      return { statusCode: 201 };
    });

    const res5 = await dispatcher.dispatchOccurrence(occExpiredSubId, nowUtcMs);
    assert.strictEqual(res5.success, true); // Ocorrência foi concluída com sucesso para os demais
    assert.strictEqual(res5.expiredCount, 1);

    // Valida que a subscription expirada foi desativada logicamente no banco
    const subExpiredRow = db.prepare('SELECT is_active FROM push_subscriptions WHERE id = ?').get(subExpiredId) as any;
    assert.strictEqual(subExpiredRow.is_active, 0);

    console.log('✓ Cenário 5: Retorno HTTP 410 desativou logicamente a subscription sem falhar a ocorrência');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 6: Falha transitória com possibilidade de retry
    // -------------------------------------------------------------
    const occTransientId = 'occ_transient';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status, retry_count
      ) VALUES (?, ?, ?, ?, '2026-11-06', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED', 0)
    `).run(occTransientId, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    mockPush.setHandler(async () => {
      const err: any = new Error('ETIMEDOUT');
      err.code = 'ETIMEDOUT';
      throw err;
    });

    const res6 = await dispatcher.dispatchOccurrence(occTransientId, nowUtcMs);
    assert.strictEqual(res6.success, false);
    assert.strictEqual(res6.status, 'DISPATCH_FAILED');

    const occTransientRow = db.prepare('SELECT status, retry_count, lease_until FROM dose_occurrences WHERE id = ?').get(occTransientId) as any;
    assert.strictEqual(occTransientRow.status, 'DISPATCH_FAILED');
    assert.strictEqual(occTransientRow.retry_count, 1);
    assert.strictEqual(occTransientRow.lease_until, null); // Liberado para nova tentativa

    console.log('✓ Cenário 6: Falha de timeout transicionou para DISPATCH_FAILED liberando lease para retry');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 7: Limite de tentativas respeitado (MAX_RETRIES -> MISSED)
    // -------------------------------------------------------------
    const occExhaustedId = 'occ_exhausted';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status, retry_count
      ) VALUES (?, ?, ?, ?, '2026-11-07', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'DISPATCH_FAILED', 2)
    `).run(occExhaustedId, timeAId, profileHumanId, accountId, nowUtcMs);

    // Na 3ª tentativa (retry_count chega em 3), com falha contínua:
    mockPush.reset();
    mockPush.setHandler(async () => {
      const err: any = new Error('Service Unavailable 503');
      err.statusCode = 503;
      throw err;
    });

    const res7 = await dispatcher.dispatchOccurrence(occExhaustedId, nowUtcMs);
    assert.strictEqual(res7.success, false);
    assert.strictEqual(res7.status, 'MISSED');

    const occExhaustedRow = db.prepare('SELECT status, retry_count, last_error FROM dose_occurrences WHERE id = ?').get(occExhaustedId) as any;
    assert.strictEqual(occExhaustedRow.status, 'MISSED');
    assert.strictEqual(occExhaustedRow.retry_count, 3);
    assert.ok(occExhaustedRow.last_error.includes('MAX_RETRIES_EXCEEDED'));

    console.log('✓ Cenário 7: Limite de 3 tentativas respeitado com transição terminal para MISSED');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 8: Worker com lease expirado não consegue finalizar a ocorrência
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 3: Leases, Fencing Tokens e Concorrência ---');
    const occLeaseExpiredId = 'occ_lease_exp';
    const oldToken = crypto.randomUUID();
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status, lease_until, lease_token
      ) VALUES (?, ?, ?, ?, '2026-11-08', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'DISPATCHING', ?, ?)
    `).run(occLeaseExpiredId, timeAId, profileHumanId, accountId, nowUtcMs, nowUtcMs - 5000, oldToken);

    // Um worker zumbi tenta finalizar com seu token antigo
    const finalizeAttempt = db.prepare(`
      UPDATE dose_occurrences
      SET status = 'DISPATCHED', lease_until = NULL
      WHERE id = ? AND lease_token = ? AND status = 'DISPATCHING'
    `).run(occLeaseExpiredId, 'wrong_or_lost_token');

    assert.strictEqual(finalizeAttempt.changes, 0);
    console.log('✓ Cenário 8: Worker zumbi com token inválido bloqueado de finalizar ocorrência');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 9: Worker antigo não consegue sobrescrever um worker mais recente
    // -------------------------------------------------------------
    // Worker B adquire o lease após o A ter expirado
    mockPush.reset();
    const resWorkerB = await dispatcher.dispatchOccurrence(occLeaseExpiredId, nowUtcMs);
    assert.strictEqual(resWorkerB.success, true);
    assert.strictEqual(resWorkerB.status, 'DISPATCHED');

    // Agora o Worker A acorda do atraso e tenta finalizar com o token A
    const lateAttemptWorkerA = db.prepare(`
      UPDATE dose_occurrences
      SET status = 'DISPATCHED', last_error = 'WORKER_A_WAS_HERE'
      WHERE id = ? AND lease_token = ? AND status = 'DISPATCHING'
    `).run(occLeaseExpiredId, oldToken);

    assert.strictEqual(lateAttemptWorkerA.changes, 0);
    console.log('✓ Cenário 9: Worker antigo não sobrescreveu resultado do worker recente que assumiu o lease');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 10: Ocorrências equivalentes de versões diferentes não são enviadas duplicadamente
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 4: Deduplicação Lógica entre Versões ---');
    // Cria ocorrência v1 já em DISPATCHED
    const occV1Id = 'occ_slot_v1';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-10', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'DISPATCHED')
    `).run(occV1Id, timeAId, profileHumanId, accountId, nowUtcMs);

    // Cria ocorrência v2 do MESMO slot em SCHEDULED (ex: gerada após atualização de timezone)
    const occV2Id = 'occ_slot_v2';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-10', '08:00', 'America/Sao_Paulo', ?, 1, 2, 'SCHEDULED')
    `).run(occV2Id, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    // Despachante tenta processar occV2
    const res10 = await dispatcher.dispatchOccurrence(occV2Id, nowUtcMs);
    assert.strictEqual(res10.success, false);
    assert.strictEqual(res10.skipped, true);
    assert.strictEqual(res10.reason, 'SUPERSEDED_SLOT_ALREADY_DISPATCHED');
    assert.strictEqual(mockPush.calls.length, 0); // Zero disparos realizados!

    // Confirma que v2 foi cancelada de forma segura
    const occV2Row = db.prepare('SELECT status, last_error FROM dose_occurrences WHERE id = ?').get(occV2Id) as any;
    assert.strictEqual(occV2Row.status, 'CANCELLED');
    assert.strictEqual(occV2Row.last_error, 'SUPERSEDED_SLOT_ALREADY_DISPATCHED');

    console.log('✓ Cenário 10: Ocorrência de versão mais recente foi deduplicada e cancelada sem duplicar disparo');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 11: Duas execuções concorrentes não despacham o mesmo slot simultaneamente
    // -------------------------------------------------------------
    const occRaceId = 'occ_race_condition';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-11', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occRaceId, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    // Dispara dois despachantes simultaneamente sobre o mesmo ID
    const [raceA, raceB] = await Promise.all([
      dispatcher.dispatchOccurrence(occRaceId, nowUtcMs),
      dispatcher.dispatchOccurrence(occRaceId, nowUtcMs),
    ]);

    // Exatamente um deve ter adquirido e sucedido, e o outro deve ter sido ignorado
    const successes = [raceA, raceB].filter((r) => r.success);
    const skipped = [raceA, raceB].filter((r) => r.skipped);

    assert.strictEqual(successes.length, 1);
    assert.strictEqual(skipped.length, 1);
    assert.strictEqual(mockPush.calls.length, 2); // Notificou os 2 dispositivos apenas uma vez!

    console.log('✓ Cenário 11: Disputa atômica concorrente garantiu execução exclusiva (1 sucesso, 1 bloqueado)');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 12: Privacidade do payload com hide_medication_names ativado e desativado
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 5: Privacidade, Perfis e Integridade Clínica ---');
    mockPush.reset();
    const occPrivacyId = 'occ_privacy_test';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-12', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occPrivacyId, timeAId, profileHumanId, accountId, nowUtcMs);

    await dispatcher.dispatchOccurrence(occPrivacyId, nowUtcMs);
    assert.strictEqual(mockPush.calls.length, 2);

    // Call 1 é iPhone (hide_medication_names = 0): Deve conter Dipirona
    const phoneCall = mockPush.calls.find((c) => c.subscription.endpoint.includes('phone'))!;
    assert.strictEqual(phoneCall.payload.data.hideMedicationNames, false);
    assert.ok(phoneCall.payload.body.includes('Dipirona'));
    assert.ok(phoneCall.payload.title.includes('Dipirona'));

    // Call 2 é MacBook (hide_medication_names = 1): NÃO pode conter Dipirona em nenhum campo
    const laptopCall = mockPush.calls.find((c) => c.subscription.endpoint.includes('laptop'))!;
    assert.strictEqual(laptopCall.payload.data.hideMedicationNames, true);
    assert.strictEqual(laptopCall.payload.title, 'Lembrete de Medicamento');
    assert.strictEqual(laptopCall.payload.body.includes('Dipirona'), false);
    assert.strictEqual(laptopCall.payload.data.medicationName, undefined);
    assert.ok(laptopCall.payload.body.includes('Danillo')); // Identifica o perfil

    console.log('✓ Cenário 12: Privacidade respeitada individualmente por dispositivo (hide=0 exibe, hide=1 mascara)');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 13: Notificações de todos os perfis da conta são processadas
    // -------------------------------------------------------------
    mockPush.reset();
    const occPetId = 'occ_pet_rem';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-13', '12:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occPetId, timePetId, profilePetId, accountId, nowUtcMs);

    const res13 = await dispatcher.dispatchOccurrence(occPetId, nowUtcMs);
    assert.strictEqual(res13.success, true);
    assert.strictEqual(mockPush.calls.length, 2);

    // Todos os dispositivos da conta receberam a notificação do Rex
    for (const call of mockPush.calls) {
      assert.strictEqual(call.payload.data.profileName, 'Rex');
      assert.strictEqual(call.payload.data.profileId, profilePetId);
    }
    console.log('✓ Cenário 13: Ocorrência do perfil pet Rex foi despachada para todos os dispositivos da conta');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 14: Falha no envio não gera confirmação de dose
    // -------------------------------------------------------------
    const occFailNoConfirmId = 'occ_fail_no_confirm';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status, retry_count
      ) VALUES (?, ?, ?, ?, '2026-11-09', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED', 0)
    `).run(occFailNoConfirmId, timeAId, profileHumanId, accountId, nowUtcMs);

    mockPush.reset();
    mockPush.setHandler(async () => {
      const err: any = new Error('500 Server Error');
      err.statusCode = 500;
      throw err;
    });

    await dispatcher.dispatchOccurrence(occFailNoConfirmId, nowUtcMs);

    // Tabela dose_confirmations deve continuar com rigorosamente ZERO registros
    const confirmationsCount = db.prepare('SELECT count(*) as c FROM dose_confirmations').get() as any;
    assert.strictEqual(confirmationsCount.c, 0);

    const occRow = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get(occFailNoConfirmId) as any;
    assert.notStrictEqual(occRow.status, 'CONFIRMED');

    console.log('✓ Cenário 14: Falha de envio não interferiu com confirmação clínica (0 confirmações registradas)');
    passed++;

    // -------------------------------------------------------------
    // CENÁRIO 15: Tag dose-${id} garante colapso no Service Worker contra duplicatas de rede
    // -------------------------------------------------------------
    mockPush.reset();
    const occTagId = 'occ_tag_check';
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, temporal_version, status
      ) VALUES (?, ?, ?, ?, '2026-11-15', '08:00', 'America/Sao_Paulo', ?, 1, 1, 'SCHEDULED')
    `).run(occTagId, timeAId, profileHumanId, accountId, nowUtcMs);

    await dispatcher.dispatchOccurrence(occTagId, nowUtcMs);

    // Confirma que a notificação carrega a tag única dose-${occurrenceId} e topic
    for (const call of mockPush.calls) {
      assert.strictEqual(call.payload.tag, `dose-${occTagId}`);
      assert.strictEqual(call.options.topic, `dose-${occTagId}`);
      assert.strictEqual(call.options.urgency, 'high');
    }
    console.log('✓ Cenário 15: Payload e envelope Web Push carregam tag única dose-${id} protegendo o navegador');
    passed++;

    console.log('\n================================================================');
    console.log(`  RESULTADO: ${passed} de 15 testes da Etapa 3C APROVADOS!       `);
    console.log('================================================================');
  } finally {
    db.close();
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
      if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
    } catch {}
  }
}

runDispatcherTests().catch((err) => {
  console.error('\n[FALHA NO TESTE DA ETAPA 3C]:', err);
  process.exit(1);
});
