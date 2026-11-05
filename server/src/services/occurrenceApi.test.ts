import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { ProfileService } from './profileService.js';
import { MedicationService } from './medicationService.js';
import { MedicationTimeService } from './medicationTimeService.js';
import { OccurrenceService } from './occurrenceService.js';

test('Fase 1: Ocorrências e Confirmações Reais no SQLite', async (t) => {
  // 1. Banco em memória com migrations executadas
  const db = new Database(':memory:');
  runVersionedMigrations(db);

  const authService = new AuthService(db);
  const profileService = new ProfileService(db);
  const medicationService = new MedicationService(db);
  const medicationTimeService = new MedicationTimeService(db);
  const occurrenceService = new OccurrenceService(db, 'America/Sao_Paulo');

  // Cria contas A e B
  const userA = authService.register({ username: 'user_a', password: 'password123' });
  const userB = authService.register({ username: 'user_b', password: 'password123' });

  // Cria perfis para a Conta A
  const profileA = profileService.createProfile(userA.account.id, {
    name: 'Camilla',
    surname: 'Silva',
    avatar: 'young-woman',
    isMainProfile: true,
  });

  // Cria medicamentos e horários para Profile A
  const medDaily = medicationService.createMedication(userA.account.id, profileA.id, {
    name: 'Vitamina D',
    dosage: '1 cápsula',
    recurrence: 'DAILY',
  });
  assert.ok(medDaily.medication);

  const time1 = medicationTimeService.createMedicationTime(userA.account.id, medDaily.medication.id, {
    time: '08:00',
  });
  const time2 = medicationTimeService.createMedicationTime(userA.account.id, medDaily.medication.id, {
    time: '20:00',
  });
  assert.ok(time1.time);
  assert.ok(time2.time);

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  await t.test('1. Deve listar as ocorrências do dia para o perfil ativo', () => {
    const occs = occurrenceService.listOccurrencesByDate(userA.account.id, profileA.id, todayStr);
    assert.equal(occs.length, 2, 'Deve ter gerado 2 doses programadas para o dia');
    assert.equal(occs[0]?.scheduledTime, '08:00');
    assert.equal(occs[0]?.medicationName, 'Vitamina D');
    assert.equal(occs[0]?.status, 'SCHEDULED');
    assert.equal(occs[1]?.scheduledTime, '20:00');
  });

  await t.test('2. Deve confirmar a tomada de uma dose e persistir em dose_confirmations', () => {
    const occs = occurrenceService.listOccurrencesByDate(userA.account.id, profileA.id, todayStr);
    const firstOcc = occs[0]!;

    const result = occurrenceService.confirmOccurrence(userA.account.id, profileA.id, firstOcc.id);
    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');

    // Valida diretamente no banco SQLite
    const occRow = db.prepare('SELECT status, confirmed_at FROM dose_occurrences WHERE id = ?').get(firstOcc.id) as any;
    assert.equal(occRow.status, 'CONFIRMED');
    assert.ok(occRow.confirmed_at);

    const confRow = db.prepare('SELECT * FROM dose_confirmations WHERE occurrence_id = ?').get(firstOcc.id) as any;
    assert.ok(confRow);
    assert.equal(confRow.status, 'TAKEN');
    assert.equal(confRow.source, 'APP_UI');
  });

  await t.test('3. Confirmação idempotente não deve gerar registros duplicados em dose_confirmations', () => {
    const occs = occurrenceService.listOccurrencesByDate(userA.account.id, profileA.id, todayStr);
    const firstOcc = occs[0]!;

    // Executa a confirmação novamente
    occurrenceService.confirmOccurrence(userA.account.id, profileA.id, firstOcc.id);

    const count = db.prepare('SELECT count(*) as total FROM dose_confirmations WHERE occurrence_id = ?').get(firstOcc.id) as any;
    assert.equal(count.total, 1, 'Deve haver estritamente 1 registro em dose_confirmations');
  });

  await t.test('4. Deve permitir desmarcar (unconfirm) e limpar dose_confirmations', () => {
    const occs = occurrenceService.listOccurrencesByDate(userA.account.id, profileA.id, todayStr);
    const firstOcc = occs[0]!;

    const result = occurrenceService.unconfirmOccurrence(userA.account.id, profileA.id, firstOcc.id);
    assert.equal(result.success, true);
    assert.equal(result.status, 'SCHEDULED');

    const occRow = db.prepare('SELECT status, confirmed_at FROM dose_occurrences WHERE id = ?').get(firstOcc.id) as any;
    assert.equal(occRow.status, 'SCHEDULED');
    assert.equal(occRow.confirmed_at, null);

    const confRow = db.prepare('SELECT * FROM dose_confirmations WHERE occurrence_id = ?').get(firstOcc.id) as any;
    assert.equal(confRow, undefined, 'Registro de confirmação deve ter sido removido');
  });

  await t.test('5. Isolamento: Conta B não consegue ler nem confirmar ocorrências da Conta A', () => {
    const occs = occurrenceService.listOccurrencesByDate(userB.account.id, profileA.id, todayStr);
    assert.equal(occs.length, 0, 'Conta B não deve ver nenhuma ocorrência do perfil da Conta A');

    const firstOccA = occurrenceService.listOccurrencesByDate(userA.account.id, profileA.id, todayStr)[0]!;
    const confirmRes = occurrenceService.confirmOccurrence(userB.account.id, profileA.id, firstOccA.id);
    assert.equal(confirmRes.success, false);
    assert.equal(confirmRes.error, 'NOT_FOUND');
  });

  await t.test('6. Rotas HTTP REST (/api/v1/profiles/:profileId/occurrences)', async () => {
    const { handleProfileRoutes } = await import('../api/profileRoutes.js');
    const { Readable } = await import('node:stream');

    function callHttp(method: string, url: string, body?: any, token?: string) {
      const reqStream = new Readable({
        read() {
          if (body !== undefined) {
            this.push(typeof body === 'string' ? body : JSON.stringify(body));
          }
          this.push(null);
        },
      });

      const headers: Record<string, string> = { host: 'localhost' };
      if (token) headers['authorization'] = `Bearer ${token}`;

      const req = Object.assign(reqStream, { method, url, headers }) as any;
      let capturedStatus = 200;
      let responseData = '';

      let resolveResponse: (res: any) => void;
      const promise = new Promise<any>((r) => { resolveResponse = r; });

      const res = {
        setHeader() { return this; },
        writeHead(status: number) { capturedStatus = status; return this; },
        end(data?: string) {
          if (data) responseData += data;
          resolveResponse({
            statusCode: capturedStatus,
            body: responseData ? JSON.parse(responseData) : null,
          });
        },
      } as any;

      handleProfileRoutes(req, res, profileService, medicationService, authService, occurrenceService);
      return promise;
    }

    // 6.1. GET /api/v1/profiles/:profileId/occurrences?date=YYYY-MM-DD
    const getRes = await callHttp(
      'GET',
      `/api/v1/profiles/${profileA.id}/occurrences?date=${todayStr}`,
      undefined,
      userA.accessToken
    );
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.body.occurrences.length, 2);

    const occId = getRes.body.occurrences[0].id;

    // 6.2. POST confirm
    const postConfirmRes = await callHttp(
      'POST',
      `/api/v1/profiles/${profileA.id}/occurrences/${occId}/confirm`,
      {},
      userA.accessToken
    );
    assert.equal(postConfirmRes.statusCode, 200);
    assert.equal(postConfirmRes.body.status, 'CONFIRMED');

    // 6.3. POST unconfirm
    const postUnconfirmRes = await callHttp(
      'POST',
      `/api/v1/profiles/${profileA.id}/occurrences/${occId}/unconfirm`,
      {},
      userA.accessToken
    );
    assert.equal(postUnconfirmRes.statusCode, 200);
    assert.equal(postUnconfirmRes.body.status, 'SCHEDULED');

    // 6.4. Conta B não tem acesso (404 ou lista vazia)
    const bGetRes = await callHttp(
      'GET',
      `/api/v1/profiles/${profileA.id}/occurrences?date=${todayStr}`,
      undefined,
      userB.accessToken
    );
    assert.equal(bGetRes.statusCode, 200);
    assert.equal(bGetRes.body.occurrences.length, 0);
  });
});
