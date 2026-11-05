import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runVersionedMigrations } from '../db/migrator.js';
import { OccurrenceGeneratorService } from './occurrenceGeneratorService.js';
import { PushDispatcherService } from './pushDispatcherService.js';
import { SchedulerService } from './schedulerService.js';

function createInMemoryTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runVersionedMigrations(db);
  return db;
}

function seedTestAccountAndMedication(
  db: Database.Database,
  options?: { time?: string; scheduledDate?: string }
) {
  const accountId = 'acc_test_scheduler';
  const profileId = 'prof_test_scheduler';
  const medicationId = 'med_test_scheduler';
  const timeId = 'time_test_scheduler';
  const time = options?.time || '10:00';

  db.prepare(`
    INSERT INTO accounts (id, username, password_hash, salt, created_at, updated_at)
    VALUES (?, 'scheduler_user', 'hash', 'salt', datetime('now'), datetime('now'))
  `).run(accountId);

  db.prepare(`
    INSERT INTO profiles (id, account_id, name, avatar, is_main_profile, version, created_at, updated_at)
    VALUES (?, ?, 'Scheduler Profile', 'adult-man', 1, 1, datetime('now'), datetime('now'))
  `).run(profileId, accountId);

  db.prepare(`
    INSERT INTO medications (id, profile_id, account_id, name, recurrence, version, created_at, updated_at)
    VALUES (?, ?, ?, 'Medicamento Teste', 'DAILY', 1, datetime('now'), datetime('now'))
  `).run(medicationId, profileId, accountId);

  db.prepare(`
    INSERT INTO medication_times (id, medication_id, profile_id, account_id, time, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).run(timeId, medicationId, profileId, accountId, time);

  return { accountId, profileId, medicationId, timeId, time };
}

async function runTests() {
  console.log('================================================================');
  console.log('  Suíte de Testes Automatizados — Scheduler Automático (3F)     ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TESTE 1: Inicialização e execução do primeiro ciclo
  // --------------------------------------------------------------------------
  console.log('--- TESTE 1: O scheduler inicia e executa o ciclo inicial ---');
  {
    const db = createInMemoryTestDb();
    seedTestAccountAndMedication(db);

    const scheduler = new SchedulerService({ db, intervalMs: 1000 });
    assert.equal(scheduler.getIsRunning(), false);

    scheduler.start();
    assert.equal(scheduler.getIsRunning(), true);

    // Aguarda o ciclo inicial concluir
    await new Promise((r) => setTimeout(r, 100));

    assert.ok(scheduler.getCycleCount() >= 1, 'Deve ter executado pelo menos 1 ciclo');
    const occs = db.prepare('SELECT count(*) as count FROM dose_occurrences').get() as { count: number };
    assert.ok(occs.count >= 2, 'Ocorrências devem ter sido geradas no ciclo inicial');

    await scheduler.stop();
    assert.equal(scheduler.getIsRunning(), false);
    console.log('✓ 1. Scheduler iniciou corretamente e executou o ciclo inicial.');
  }

  // --------------------------------------------------------------------------
  // TESTE 2: Ticker em intervalos regulares
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 2: O ticker executa periodicamente nos intervalos configurados ---');
  {
    const db = createInMemoryTestDb();
    seedTestAccountAndMedication(db);

    const scheduler = new SchedulerService({ db, intervalMs: 80 });
    scheduler.start();

    // Aguarda ~250ms (deve executar inicial + pelo menos 2 ticks adicionais)
    await new Promise((r) => setTimeout(r, 260));

    const count = scheduler.getCycleCount();
    assert.ok(count >= 3, `Deve ter executado múltiplos ciclos periódicos. Executados: ${count}`);

    await scheduler.stop();
    console.log(`✓ 2. Ticker executou periodicamente com sucesso (${count} ciclos).`);
  }

  // --------------------------------------------------------------------------
  // TESTE 3: Ordem de execução (Geração ANTES do Despacho)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 3: A geração ocorre estritamente antes do despacho ---');
  {
    const db = createInMemoryTestDb();
    const order: string[] = [];

    const mockGenerator = {
      generateOccurrences: () => {
        order.push('GENERATE');
        return { generatedCount: 1, horizonDays: 2, timezone: 'UTC', temporalVersion: 1, startDate: '2026-11-05', endDate: '2026-11-06' };
      },
    } as any;

    const mockDispatcher = {
      dispatchEligibleOccurrences: async () => {
        order.push('DISPATCH');
        return { nowUtcMs: Date.now(), evaluatedCount: 1, dispatchedCount: 1, skippedCount: 0, failedCount: 0, totalPushSent: 1, totalPushFailed: 0, results: [] };
      },
    } as any;

    const scheduler = new SchedulerService({
      db,
      generator: mockGenerator,
      dispatcher: mockDispatcher,
    });

    await scheduler.runCycle();

    assert.deepEqual(order, ['GENERATE', 'DISPATCH'], 'A ordem deve ser GENERATE e depois DISPATCH');
    console.log('✓ 3. Geração confirmada estritamente antes do despacho no ciclo.');
  }

  // --------------------------------------------------------------------------
  // TESTE 4: Idempotência de execução repetida (sem duplicações)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 4: Execuções repetidas não duplicam ocorrências ---');
  {
    const db = createInMemoryTestDb();
    seedTestAccountAndMedication(db);

    const scheduler = new SchedulerService({ db, horizonDays: 2 });

    const res1 = await scheduler.runCycle();
    assert.ok((res1?.generatorResult?.generatedCount ?? 0) >= 2, 'Ciclo 1 gera novas ocorrências');

    const totalOccs1 = (db.prepare('SELECT count(*) as count FROM dose_occurrences').get() as any).count;

    // Ciclo 2 imediato
    const res2 = await scheduler.runCycle();
    assert.equal(res2?.generatorResult?.generatedCount, 0, 'Ciclo 2 deve reportar 0 novas ocorrências');

    // Ciclo 3 imediato
    const res3 = await scheduler.runCycle();
    assert.equal(res3?.generatorResult?.generatedCount, 0, 'Ciclo 3 deve reportar 0 novas ocorrências');

    const totalOccs3 = (db.prepare('SELECT count(*) as count FROM dose_occurrences').get() as any).count;
    assert.equal(totalOccs1, totalOccs3, 'Total de ocorrências deve permanecer idêntico');
    console.log('✓ 4. Idempotência estrita: 0 ocorrências duplicadas em 3 execuções consecutivas.');
  }

  // --------------------------------------------------------------------------
  // TESTE 5: Proteção contra ciclos sobrepostos (Overlap Protection)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 5: Prevenção contra ciclos sobrepostos ---');
  {
    const db = createInMemoryTestDb();

    let slowDispatchStarted = false;
    const mockDispatcher = {
      dispatchEligibleOccurrences: async () => {
        slowDispatchStarted = true;
        // Simula processamento assíncrono demorado
        await new Promise((r) => setTimeout(r, 100));
        return { nowUtcMs: Date.now(), evaluatedCount: 0, dispatchedCount: 0, skippedCount: 0, failedCount: 0, totalPushSent: 0, totalPushFailed: 0, results: [] };
      },
    } as any;

    const scheduler = new SchedulerService({ db, dispatcher: mockDispatcher });

    // Inicia ciclo 1 (lento)
    const p1 = scheduler.runCycle();

    // Tenta disparar ciclo 2 imediatamente enquanto o 1 está ativo
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(scheduler.getIsCycleRunning(), 'Ciclo 1 deve estar em andamento');

    const res2 = await scheduler.runCycle();
    assert.equal(res2?.skippedOverlapping, true, 'Ciclo 2 deve ser ignorado por sobreposição');

    await p1;
    assert.equal(scheduler.getIsCycleRunning(), false);
    console.log('✓ 5. Ciclo sobreposto foi detectado e ignorado com sucesso.');
  }

  // --------------------------------------------------------------------------
  // TESTE 6: Resiliência a falhas (erro em etapa não mata o ticker nem etapas seguintes)
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 6: Resiliência — falha em uma etapa não interrompe o ciclo nem o ticker ---');
  {
    const db = createInMemoryTestDb();

    let dispatchCalled = false;
    const failingGenerator = {
      generateOccurrences: () => {
        throw new Error('Falha simulada no gerador');
      },
    } as any;

    const healthyDispatcher = {
      dispatchEligibleOccurrences: async () => {
        dispatchCalled = true;
        return { nowUtcMs: Date.now(), evaluatedCount: 0, dispatchedCount: 0, skippedCount: 0, failedCount: 0, totalPushSent: 0, totalPushFailed: 0, results: [] };
      },
    } as any;

    const scheduler = new SchedulerService({
      db,
      generator: failingGenerator,
      dispatcher: healthyDispatcher,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });

    const res = await scheduler.runCycle();
    assert.ok(res?.error?.includes('Falha na geração'), 'Erro do gerador deve ser registrado');
    assert.equal(dispatchCalled, true, 'O despacho deve ter sido executado mesmo após falha na geração');
    console.log('✓ 6. Resiliência comprovada: despacho prosseguiu e erro foi isolado.');
  }

  // --------------------------------------------------------------------------
  // TESTE 7: Encerramento gracioso limpa timer e aguarda ciclo ativo
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 7: Encerramento gracioso aguarda ciclo ativo e limpa ticker ---');
  {
    const db = createInMemoryTestDb();

    let cycleFinished = false;
    const slowDispatcher = {
      dispatchEligibleOccurrences: async () => {
        await new Promise((r) => setTimeout(r, 80));
        cycleFinished = true;
        return { nowUtcMs: Date.now(), evaluatedCount: 0, dispatchedCount: 0, skippedCount: 0, failedCount: 0, totalPushSent: 0, totalPushFailed: 0, results: [] };
      },
    } as any;

    const scheduler = new SchedulerService({ db, dispatcher: slowDispatcher, intervalMs: 50 });
    scheduler.start();

    // Dispara stop enquanto o ciclo inicial demorado está rodando
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(scheduler.getIsCycleRunning(), true);

    await scheduler.stop(500);

    assert.equal(cycleFinished, true, 'Ciclo em andamento deve ter sido aguardado antes do término do stop()');
    assert.equal(scheduler.getIsRunning(), false);
    assert.equal(scheduler.getIsCycleRunning(), false);
    console.log('✓ 7. Encerramento gracioso aguardou ciclo em andamento e encerrou com segurança.');
  }

  // --------------------------------------------------------------------------
  // TESTE 8 & 9: Ocorrências futuras não são enviadas; vencidas são despachadas
  // --------------------------------------------------------------------------
  console.log('\n--- TESTES 8 & 9: Ocorrências futuras protegidas vs. elegíveis despachadas ---');
  {
    const db = createInMemoryTestDb();
    const { accountId, timeId } = seedTestAccountAndMedication(db);

    const now = Date.now();
    const futureUtc = now + 3600000; // 1 hora no futuro
    const pastUtc = now - 60000; // 1 minuto no passado (elegível)

    // Ocorrência futura
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, timezone,
        scheduled_at_utc, schedule_version, temporal_version, status, created_at, updated_at
      ) VALUES ('occ_future', ?, 'prof_test_scheduler', ?, '2026-11-05', '11:00', 'UTC', ?, 1, 1, 'SCHEDULED', datetime('now'), datetime('now'))
    `).run(timeId, accountId, futureUtc);

    // Ocorrência vencida
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, timezone,
        scheduled_at_utc, schedule_version, temporal_version, status, created_at, updated_at
      ) VALUES ('occ_past', ?, 'prof_test_scheduler', ?, '2026-11-05', '09:00', 'UTC', ?, 1, 1, 'SCHEDULED', datetime('now'), datetime('now'))
    `).run(timeId, accountId, pastUtc);

    const mockWebpush = {
      sendNotification: async () => ({ statusCode: 201 }),
    } as any;

    const dispatcher = new PushDispatcherService({ db, webpushClient: mockWebpush });
    const scheduler = new SchedulerService({ db, dispatcher });

    const cycleRes = await scheduler.runCycle();

    // Apenas a passada deve ter sido avaliada para despacho
    assert.equal(cycleRes?.dispatcherResult?.evaluatedCount, 1, 'Apenas 1 ocorrência elegível (passada) deve ser avaliada');

    const futureOcc = db.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_future'").get() as any;
    assert.equal(futureOcc.status, 'SCHEDULED', 'Ocorrência futura deve permanecer SCHEDULED');

    const pastOcc = db.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_past'").get() as any;
    assert.equal(pastOcc.status, 'DISPATCHED', 'Ocorrência vencida deve ser transicionada para DISPATCHED');

    console.log('✓ 8. Ocorrência futura permaneceu SCHEDULED sem envio antecipado.');
    console.log('✓ 9. Ocorrência vencida foi despachada com sucesso.');
  }

  // --------------------------------------------------------------------------
  // TESTE 10: Leases, fencing tokens e retries preservados
  // --------------------------------------------------------------------------
  console.log('\n--- TESTE 10: Fencing tokens e leases garantidos sob o scheduler ---');
  {
    const db = createInMemoryTestDb();
    const { accountId, timeId } = seedTestAccountAndMedication(db);

    const now = Date.now();
    // Ocorrência em DISPATCHING com lease ativo
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, timezone,
        scheduled_at_utc, schedule_version, temporal_version, status, lease_until, lease_token, retry_count, created_at, updated_at
      ) VALUES ('occ_locked', ?, 'prof_test_scheduler', ?, '2026-11-05', '09:00', 'UTC', ?, 1, 1, 'DISPATCHING', ?, 'valid_token', 1, datetime('now'), datetime('now'))
    `).run(timeId, accountId, now - 5000, now + 30000);

    const dispatcher = new PushDispatcherService({ db });
    const scheduler = new SchedulerService({ db, dispatcher });

    const res = await scheduler.runCycle();
    assert.equal(res?.dispatcherResult?.evaluatedCount, 0, 'Ocorrência com lease ativo não deve ser avaliada por outro ciclo');

    const occ = db.prepare("SELECT status, lease_token FROM dose_occurrences WHERE id = 'occ_locked'").get() as any;
    assert.equal(occ.status, 'DISPATCHING');
    assert.equal(occ.lease_token, 'valid_token');
    console.log('✓ 10. Leases ativos e fencing tokens foram rigorosamente respeitados.');
  }

  console.log('\n================================================================');
  console.log('  TODOS OS 10 TESTES DO SCHEDULER AUTOMÁTICO FORAM APROVADOS!   ');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ ERRO NA SUÍTE DO SCHEDULER:', err);
  process.exit(1);
});
