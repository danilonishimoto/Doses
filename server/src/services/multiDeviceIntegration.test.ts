import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { ProfileService } from './profileService.js';
import { MedicationService } from './medicationService.js';
import { MedicationTimeService } from './medicationTimeService.js';
import { SubscriptionService } from './subscriptionService.js';
import { OccurrenceGeneratorService } from './occurrenceGeneratorService.js';
import { PushDispatcherService } from './pushDispatcherService.js';
import { verifyJwt } from '../utils/jwt.js';

interface MockPushCall {
  subscription: any;
  payload: any;
  options: any;
}

class MockWebPushClient {
  public calls: MockPushCall[] = [];

  async sendNotification(subscription: any, payload: string, options: any) {
    this.calls.push({
      subscription,
      payload: JSON.parse(payload),
      options,
    });
    return { statusCode: 201 };
  }

  reset() {
    this.calls = [];
  }
}

test('Etapa 4 — Integração Frontend/Backend e Web Push Multidispositivo', async (t) => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runVersionedMigrations(db);

  const authService = new AuthService(db);
  const profileService = new ProfileService(db);
  const medicationService = new MedicationService(db);
  const medicationTimeService = new MedicationTimeService(db);
  const subscriptionService = new SubscriptionService(db);
  const generatorService = new OccurrenceGeneratorService(db, 'America/Sao_Paulo');
  const mockPushClient = new MockWebPushClient();
  const dispatcherService = new PushDispatcherService({
    db,
    webpushClient: mockPushClient as any,
  });

  let accountId = '';
  let accessToken = '';
  let refreshToken = '';
  let sessionId = '';
  let profileId = '';
  let medicationId = '';
  let timeId = '';

  await t.test('1. Autenticação: Registro de conta, sessão e obtenção de tokens', async () => {
    const regResult = authService.register({
      username: 'usuario_multidispositivo',
      password: 'SenhaForte123!',
      deviceName: 'Desktop Chrome',
    });

    assert.ok(regResult.account.id, 'Deve gerar account.id');
    assert.ok(regResult.accessToken, 'Deve gerar accessToken');
    assert.ok(regResult.refreshToken, 'Deve gerar refreshToken');

    accountId = regResult.account.id;
    accessToken = regResult.accessToken;
    refreshToken = regResult.refreshToken;
    sessionId = regResult.sessionId;

    // Login subsequente
    const loginResult = authService.login({
      username: 'usuario_multidispositivo',
      password: 'SenhaForte123!',
      deviceName: 'Mobile Safari',
    });

    assert.equal(loginResult.account.id, accountId, 'Deve autenticar na mesma conta');
    assert.ok(loginResult.accessToken, 'Deve emitir novo accessToken');
    assert.ok(loginResult.refreshToken, 'Deve emitir novo refreshToken para novo dispositivo');
  });

  await t.test('2. Autenticação: Renovação de sessão via Refresh Token', async () => {
    const refreshResult = authService.refresh({ refreshToken });
    assert.ok(refreshResult.accessToken, 'Deve emitir novo accessToken renovado');
    assert.ok(refreshResult.refreshToken, 'Deve rotacionar o refreshToken');
    assert.notEqual(refreshResult.refreshToken, refreshToken, 'RefreshToken deve ser rotacionado');
    refreshToken = refreshResult.refreshToken;
    const verification = verifyJwt(refreshResult.accessToken);
    assert.equal(verification.valid, true);
    sessionId = verification.payload!.sid;
  });

  await t.test('3. Perfis: Criação, listagem e persistência no banco de dados', async () => {
    const profile = profileService.createProfile(accountId, {
      name: 'Maria Helena',
      surname: 'Silva',
      avatar: 'senior-person',
      isMainProfile: true,
    });

    assert.ok(profile.id.startsWith('prof_'), 'ID do perfil deve seguir padrão prof_');
    assert.equal(profile.name, 'Maria Helena');
    assert.equal(profile.accountId, accountId);
    assert.equal(profile.isMainProfile, true);

    profileId = profile.id;

    // A conta tem o perfil padrão criado no registro + o perfil Maria Helena recém criado
    const list = profileService.listProfiles(accountId);
    assert.equal(list.length, 2, 'Deve listar o perfil default e o novo perfil');
    assert.ok(list.some((p) => p.id === profileId), 'Novo perfil deve estar na lista');
  });

  await t.test('4. Medicamentos e Horários: Criação e associação relacional', async () => {
    const medResult = medicationService.createMedication(accountId, profileId, {
      name: 'Losartana 50mg',
      dosage: '1 comprimido pela manhã',
      recurrence: 'DAILY',
    });

    assert.ok(medResult.medication?.id, 'Medicamento deve ser criado com sucesso');
    medicationId = medResult.medication!.id;

    // Horário às 08:00
    const timeResult = medicationTimeService.createMedicationTime(accountId, medicationId, {
      time: '08:00',
    });

    assert.ok(timeResult.time?.id, 'Horário deve ser criado com sucesso');
    timeId = timeResult.time!.id;

    const timesList = medicationTimeService.listMedicationTimes(accountId, medicationId);
    assert.equal(timesList.length, 1);
    assert.equal(timesList[0].time, '08:00');
  });

  await t.test('5. Web Push Multidispositivo: Registro de duas subscriptions na mesma conta', async () => {
    // Dispositivo 1: Desktop (Privacidade desligada: quer ver o nome do remédio)
    const resDesktop = subscriptionService.registerSubscription(accountId, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/desktop-token-123',
      keys: {
        p256dh: 'mock-p256dh-desktop-key',
        auth: 'mock-auth-desktop-key',
      },
      deviceName: 'Computador MacBook Pro',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      hideMedicationNames: false,
    });

    assert.equal(resDesktop.success, true);
    if (!resDesktop.success) return;
    assert.ok(resDesktop.subscription.id);
    assert.equal(resDesktop.subscription.deviceName, 'Computador MacBook Pro');
    assert.equal(resDesktop.subscription.hideMedicationNames, false);

    // Dispositivo 2: Celular (Privacidade ligada: quer ocultar nome na tela de bloqueio)
    const resMobile = subscriptionService.registerSubscription(accountId, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/mobile-token-456',
      keys: {
        p256dh: 'mock-p256dh-mobile-key',
        auth: 'mock-auth-mobile-key',
      },
      deviceName: 'Smartphone Galaxy S24',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile)',
      hideMedicationNames: true,
    });

    assert.equal(resMobile.success, true);
    if (!resMobile.success) return;
    assert.ok(resMobile.subscription.id);
    assert.equal(resMobile.subscription.deviceName, 'Smartphone Galaxy S24');
    assert.equal(resMobile.subscription.hideMedicationNames, true);

    // Confirma que a conta possui 2 subscriptions ativas simultaneamente
    const activeSubs = subscriptionService.listSubscriptions(accountId).filter((s) => s.isActive);
    assert.equal(activeSubs.length, 2, 'A conta deve ter exatamente 2 subscriptions ativas');
  });

  let todayOcc: any = null;

  await t.test('6. Geração de Ocorrências: Ocorrência criada para o horário', async () => {
    const genResult = generatorService.generateOccurrences(2);
    assert.equal(genResult.generatedCount, 2, 'Deve gerar ocorrências para hoje e amanhã');

    const rows = db.prepare('SELECT id, status, scheduled_date, scheduled_time, scheduled_at_utc FROM dose_occurrences WHERE account_id = ? ORDER BY scheduled_at_utc ASC').all(accountId) as any[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].status, 'SCHEDULED');
    assert.equal(rows[0].scheduled_time, '08:00');
    todayOcc = rows[0];
  });

  await t.test('7. Despacho Multidispositivo: Envio para ambos os dispositivos com privacidade individual', async () => {
    mockPushClient.reset();
    assert.ok(todayOcc, 'Ocorrência de hoje deve existir');

    // Simula instante em que o horário de hoje já está vencido
    const nowUtcMs = todayOcc.scheduled_at_utc + 60000; // 1 minuto após o horário
    const batchResult = await dispatcherService.dispatchEligibleOccurrences({ nowUtcMs });

    assert.equal(batchResult.dispatchedCount, 1, '1 ocorrência deve ser despachada');
    assert.equal(batchResult.totalPushSent, 2, 'Deve enviar exatamente 2 notificações push (1 por dispositivo)');
    assert.equal(mockPushClient.calls.length, 2, 'Cliente push deve ser chamado 2 vezes');

    // Inspeciona os payloads entregues aos 2 dispositivos
    const desktopCall = mockPushClient.calls.find((c) => c.subscription.endpoint.includes('desktop'));
    const mobileCall = mockPushClient.calls.find((c) => c.subscription.endpoint.includes('mobile'));

    assert.ok(desktopCall, 'Deve ter enviado push para o Desktop');
    assert.ok(mobileCall, 'Deve ter enviado push para o Mobile');

    // Desktop: hideMedicationNames = false -> exibe nome do remédio
    assert.equal(desktopCall!.payload.body.includes('Losartana 50mg'), true, 'Desktop deve exibir nome do remédio');

    // Mobile: hideMedicationNames = true -> mascara nome do remédio
    assert.equal(mobileCall!.payload.body.includes('Losartana 50mg'), false, 'Mobile não deve exibir nome do remédio');
    assert.equal(mobileCall!.payload.body.includes('medicamento'), true, 'Mobile deve exibir mensagem protegida');

    // Verifica persistência dos disparos na tabela de rastreamento
    const dispatches = db.prepare('SELECT * FROM dose_occurrence_dispatches WHERE occurrence_id = ?').all(todayOcc.id) as any[];
    assert.equal(dispatches.length, 2, 'Deve haver 2 registros de despacho persistidos');
    assert.equal(dispatches.every((d) => d.status === 'SENT'), true);

    // Ocorrência deve estar finalizada como DISPATCHED
    const finalOcc = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get(todayOcc.id) as any;
    assert.equal(finalOcc.status, 'DISPATCHED');
  });

  await t.test('8. Logout: Revogação da sessão remota e isolamento', async () => {
    authService.logout({ sessionId, accountId });

    // Sessão revogada não deve permitir renovação
    assert.throws(
      () => authService.refresh({ refreshToken }),
      (err: any) => err.code === 'TOKEN_REUSED_FAMILY_REVOKED' || err.code === 'INVALID_TOKEN' || err.code === 'SESSION_REVOKED'
    );
  });

  db.close();
});
