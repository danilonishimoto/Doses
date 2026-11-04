import Database from 'better-sqlite3';
import { Readable } from 'node:stream';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { ProfileService } from './profileService.js';
import { MedicationService } from './medicationService.js';
import { MedicationTimeService } from './medicationTimeService.js';
import { handleProfileRoutes } from '../api/profileRoutes.js';
import { handleMedicationRoutes } from '../api/medicationRoutes.js';

console.log('================================================================');
console.log('  Suíte de Testes - Etapa 3A (Domínio de Perfis e Medicamentos) ');
console.log('================================================================\n');

// 1. Criação de banco SQLite em memória com todas as migrações (001 a 006)
const testDb = new Database(':memory:');
testDb.pragma('foreign_keys = ON');
runVersionedMigrations(testDb);

const authService = new AuthService(testDb);
const profileService = new ProfileService(testDb);
const medicationService = new MedicationService(testDb);
const medicationTimeService = new MedicationTimeService(testDb);

// Helper para chamadas mock de rotas HTTP
interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  rawBody: string;
}

function createMockReqRes(method: string, url: string, body?: any, token?: string) {
  const reqStream = new Readable({
    read() {
      if (body !== undefined) {
        this.push(typeof body === 'string' ? body : JSON.stringify(body));
      }
      this.push(null);
    },
  });

  const headers: Record<string, string> = { host: 'localhost' };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  const req = Object.assign(reqStream, {
    method,
    url,
    headers,
  }) as any;

  let resolveResponse: (res: MockResponse) => void;
  const promise = new Promise<MockResponse>((res) => {
    resolveResponse = res;
  });

  const responseHeaders: Record<string, string> = {};
  let capturedStatus = 200;
  let responseData = '';

  const res = {
    setHeader(name: string, value: string) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
    writeHead(status: number, headers?: Record<string, string>) {
      capturedStatus = status;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          responseHeaders[k.toLowerCase()] = v;
        }
      }
      return this;
    },
    write(chunk: any) {
      responseData += chunk;
      return true;
    },
    end(chunk?: any) {
      if (chunk) {
        responseData += chunk;
      }
      let parsedBody = null;
      try {
        parsedBody = responseData ? JSON.parse(responseData) : null;
      } catch {
        parsedBody = responseData;
      }
      resolveResponse({
        statusCode: capturedStatus,
        headers: responseHeaders,
        body: parsedBody,
        rawBody: responseData,
      });
    },
  } as any;

  return { req, res, getResponse: () => promise };
}

async function dispatchRequest(method: string, url: string, body?: any, token?: string) {
  const { req, res, getResponse } = createMockReqRes(method, url, body, token);

  const urlObj = new URL(url, 'http://localhost');
  if (urlObj.pathname.startsWith('/api/v1/profiles')) {
    await handleProfileRoutes(req, res, profileService, medicationService, authService);
  } else if (urlObj.pathname.startsWith('/api/v1/medications') || urlObj.pathname.startsWith('/api/v1/medication-times')) {
    await handleMedicationRoutes(req, res, medicationService, medicationTimeService, authService);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  return getResponse();
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FALHA: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✓ ${message}`);
}

async function runTestSuite() {
  // Preparação de contas de teste
  const regUserA = authService.register({ username: 'user_a', password: 'PasswordA@123' }) as any;
  const regUserB = authService.register({ username: 'user_b', password: 'PasswordB@123' }) as any;

  const tokenA = regUserA.accessToken;
  const tokenB = regUserB.accessToken;
  const accountIdA = regUserA.account.id;
  const accountIdB = regUserB.account.id;

  // --------------------------------------------------------------------------
  // GRUPO 1: Domínio de Perfis
  // --------------------------------------------------------------------------
  console.log('--- GRUPO 1: Domínio de Perfis ---');

  // Cenário 1: Criar perfil com sucesso
  const resC1 = await dispatchRequest('POST', '/api/v1/profiles', {
    name: 'Danilo',
    surname: 'Almeida',
    avatar: 'avatar_danilo.png',
    isMainProfile: true,
  }, tokenA);
  assert(resC1.statusCode === 201 && resC1.body.profile.name === 'Danilo', 'Cenário 1: Perfil criado com sucesso (201 Created)');
  const profileDaniloId = resC1.body.profile.id;

  // Cenário 2: Rejeitar perfil com nome vazio
  const resC2 = await dispatchRequest('POST', '/api/v1/profiles', {
    name: '   ',
    avatar: 'avatar.png',
  }, tokenA);
  assert(resC2.statusCode === 400 && resC2.body.error === 'Bad Request', 'Cenário 2: Rejeição de perfil com nome vazio (400 Bad Request)');

  // Cenário 3: Rejeitar perfil com avatar vazio
  const resC3 = await dispatchRequest('POST', '/api/v1/profiles', {
    name: 'Teste',
    avatar: '',
  }, tokenA);
  assert(resC3.statusCode === 400, 'Cenário 3: Rejeição de perfil com avatar vazio (400 Bad Request)');

  // Cenário 4: Criar outros tipos de perfis (Titular, Idoso, Pet) e listar perfis da conta A
  await dispatchRequest('POST', '/api/v1/profiles', {
    name: 'Dona Maria',
    surname: 'Avó',
    avatar: 'avatar_elderly.png',
    isMainProfile: false,
  }, tokenA);

  const resThor = await dispatchRequest('POST', '/api/v1/profiles', {
    name: 'Thor 🐾',
    surname: 'Pet',
    avatar: 'avatar_dog.png',
    isMainProfile: false,
  }, tokenA);
  const profileThorId = resThor.body.profile.id;

  const resListA = await dispatchRequest('GET', '/api/v1/profiles', undefined, tokenA);
  // Nota: authService.register cria um perfil padrão inicial ('user_a') + Danilo + Dona Maria + Thor = 4 perfis
  assert(resListA.statusCode === 200 && resListA.body.profiles.length === 4, 'Cenário 4: Listagem retornou os 4 perfis ativos da conta A');

  // Cenário 5: Consultar perfil por ID
  const resGetDanilo = await dispatchRequest('GET', `/api/v1/profiles/${profileDaniloId}`, undefined, tokenA);
  assert(resGetDanilo.statusCode === 200 && resGetDanilo.body.profile.id === profileDaniloId, 'Cenário 5: Consulta de perfil existente por ID com sucesso (200 OK)');

  // Cenário 6: Atualizar dados de um perfil
  const resPatch = await dispatchRequest('PATCH', `/api/v1/profiles/${profileDaniloId}`, {
    name: 'Danilo Silva',
    surname: 'de Almeida',
  }, tokenA);
  assert(resPatch.statusCode === 200 && resPatch.body.profile.name === 'Danilo Silva' && resPatch.body.profile.version === 2, 'Cenário 6: Atualização de perfil com incremento de version (200 OK)');

  // Cenário 7: Excluir logicamente um perfil
  const resDeleteThor = await dispatchRequest('DELETE', `/api/v1/profiles/${profileThorId}`, undefined, tokenA);
  assert(resDeleteThor.statusCode === 200 && resDeleteThor.body.message.includes('sucesso'), 'Cenário 7: Exclusão lógica de perfil concluída com sucesso (200 OK)');

  // Cenário 8: Perfil excluído não aparece na listagem
  const resListAfterDelete = await dispatchRequest('GET', '/api/v1/profiles', undefined, tokenA);
  const thorInList = resListAfterDelete.body.profiles.some((p: any) => p.id === profileThorId);
  assert(!thorInList && resListAfterDelete.body.profiles.length === 3, 'Cenário 8: Perfil excluído não aparece nas listagens comuns');

  // Cenário 9: Consulta de perfil excluído retorna 404
  const resGetThorDeleted = await dispatchRequest('GET', `/api/v1/profiles/${profileThorId}`, undefined, tokenA);
  assert(resGetThorDeleted.statusCode === 404, 'Cenário 9: Consulta a perfil excluído retorna 404 Not Found');

  // Cenário 10: Atualização em perfil excluído retorna 404
  const resPatchThorDeleted = await dispatchRequest('PATCH', `/api/v1/profiles/${profileThorId}`, { name: 'Thor Vivo' }, tokenA);
  assert(resPatchThorDeleted.statusCode === 404, 'Cenário 10: Tentativa de atualizar perfil excluído retorna 404 Not Found');

  // Cenário 11: Isolamento estrito entre contas - Conta B não consegue ver perfil da Conta A
  const resCrossGet = await dispatchRequest('GET', `/api/v1/profiles/${profileDaniloId}`, undefined, tokenB);
  assert(resCrossGet.statusCode === 404, 'Cenário 11: Conta B recebe 404 Not Found ao tentar ler perfil da Conta A');

  // Cenário 12: Conta B não consegue atualizar perfil da Conta A
  const resCrossPatch = await dispatchRequest('PATCH', `/api/v1/profiles/${profileDaniloId}`, { name: 'Hacker' }, tokenB);
  assert(resCrossPatch.statusCode === 404, 'Cenário 12: Conta B recebe 404 Not Found ao tentar atualizar perfil da Conta A');

  // Cenário 13: Conta B não consegue excluir perfil da Conta A
  const resCrossDelete = await dispatchRequest('DELETE', `/api/v1/profiles/${profileDaniloId}`, undefined, tokenB);
  assert(resCrossDelete.statusCode === 404, 'Cenário 13: Conta B recebe 404 Not Found ao tentar excluir perfil da Conta A');

  // Cenário 14: Tentativa de injeção de account_id no corpo do POST é ignorada
  const resInjection = await dispatchRequest('POST', '/api/v1/profiles', {
    name: 'Perfil Injetado',
    avatar: 'avatar.png',
    account_id: accountIdB, // Tentativa de forjar conta B estando autenticado como A
  }, tokenA);
  assert(resInjection.statusCode === 201 && resInjection.body.profile.accountId === accountIdA, 'Cenário 14: account_id forjado no payload ignorado; vinculado à identidade autenticada');

  // --------------------------------------------------------------------------
  // GRUPO 2: Domínio de Medicamentos
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 2: Domínio de Medicamentos ---');

  // Cenário 16: Criar medicamento para perfil válido
  const resMed1 = await dispatchRequest('POST', `/api/v1/profiles/${profileDaniloId}/medications`, {
    name: 'Losartana Potássica',
    dosage: '50mg',
    recurrence: 'DAILY',
  }, tokenA);
  assert(resMed1.statusCode === 201 && resMed1.body.medication.name === 'Losartana Potássica', 'Cenário 16: Medicamento criado para perfil válido (201 Created)');
  const medLosartanaId = resMed1.body.medication.id;

  // Cenário 17: Rejeitar medicamento com nome vazio
  const resMedEmpty = await dispatchRequest('POST', `/api/v1/profiles/${profileDaniloId}/medications`, {
    name: '  ',
    dosage: '10mg',
  }, tokenA);
  assert(resMedEmpty.statusCode === 400, 'Cenário 17: Rejeição de medicamento com nome vazio (400 Bad Request)');

  // Cenário 18: Rejeitar criação de medicamento em perfil inexistente
  const resMedNonExistProf = await dispatchRequest('POST', `/api/v1/profiles/prof_non_existent/medications`, {
    name: 'Aspirina',
  }, tokenA);
  assert(resMedNonExistProf.statusCode === 404, 'Cenário 18: Rejeição ao tentar criar medicamento para perfil inexistente (404 Not Found)');

  // Cenário 19: Rejeitar criação de medicamento em perfil excluído
  const resMedDeletedProf = await dispatchRequest('POST', `/api/v1/profiles/${profileThorId}/medications`, {
    name: 'Vermífugo',
  }, tokenA);
  assert(resMedDeletedProf.statusCode === 404, 'Cenário 19: Rejeição ao tentar criar medicamento para perfil excluído (404 Not Found)');

  // Cenário 20: Rejeitar criação de medicamento para perfil de outra conta
  const resMedCrossAccProf = await dispatchRequest('POST', `/api/v1/profiles/${profileDaniloId}/medications`, {
    name: 'Veneno',
  }, tokenB);
  assert(resMedCrossAccProf.statusCode === 404, 'Cenário 20: Conta B recebe 404 ao tentar criar medicamento em perfil da Conta A');

  // Cria mais um medicamento para o mesmo perfil
  const resMed2 = await dispatchRequest('POST', `/api/v1/profiles/${profileDaniloId}/medications`, {
    name: 'Sinvastatina',
    dosage: '20mg',
  }, tokenA);
  const medSinvastatinaId = resMed2.body.medication.id;

  // Cenário 21: Listar medicamentos de um perfil
  const resListMeds = await dispatchRequest('GET', `/api/v1/profiles/${profileDaniloId}/medications`, undefined, tokenA);
  assert(resListMeds.statusCode === 200 && resListMeds.body.medications.length === 2, 'Cenário 21: Listagem retornou os 2 medicamentos ativos do perfil (200 OK)');

  // Cenário 22: Consultar medicamento por ID
  const resGetMed = await dispatchRequest('GET', `/api/v1/medications/${medLosartanaId}`, undefined, tokenA);
  assert(resGetMed.statusCode === 200 && resGetMed.body.medication.name === 'Losartana Potássica', 'Cenário 22: Consulta individual de medicamento por ID com sucesso (200 OK)');

  // Cenário 23: Atualizar medicamento
  const resPatchMed = await dispatchRequest('PATCH', `/api/v1/medications/${medLosartanaId}`, {
    dosage: '100mg',
  }, tokenA);
  assert(resPatchMed.statusCode === 200 && resPatchMed.body.medication.dosage === '100mg' && resPatchMed.body.medication.version === 2, 'Cenário 23: Atualização de dosagem com incremento de version (200 OK)');

  // Cenário 24: Excluir medicamento logicamente
  const resDeleteMed = await dispatchRequest('DELETE', `/api/v1/medications/${medSinvastatinaId}`, undefined, tokenA);
  assert(resDeleteMed.statusCode === 200 && resDeleteMed.body.message.includes('sucesso'), 'Cenário 24: Exclusão lógica de medicamento concluída com sucesso (200 OK)');

  // Cenário 25: Medicamento excluído não aparece na listagem do perfil
  const resListMedsAfterDel = await dispatchRequest('GET', `/api/v1/profiles/${profileDaniloId}/medications`, undefined, tokenA);
  assert(resListMedsAfterDel.body.medications.length === 1 && resListMedsAfterDel.body.medications[0].id === medLosartanaId, 'Cenário 25: Medicamento excluído não aparece na listagem do perfil');

  // Cenário 26: Consulta de medicamento excluído retorna 404
  const resGetMedDel = await dispatchRequest('GET', `/api/v1/medications/${medSinvastatinaId}`, undefined, tokenA);
  assert(resGetMedDel.statusCode === 404, 'Cenário 26: Consulta a medicamento excluído retorna 404 Not Found');

  // Cenário 27: Atualização em medicamento excluído retorna 404
  const resPatchMedDel = await dispatchRequest('PATCH', `/api/v1/medications/${medSinvastatinaId}`, { dosage: '40mg' }, tokenA);
  assert(resPatchMedDel.statusCode === 404, 'Cenário 27: Atualização em medicamento excluído retorna 404 Not Found');

  // Cenário 28: Isolamento estrito entre contas - Conta B não consegue ver medicamento da Conta A
  const resCrossGetMed = await dispatchRequest('GET', `/api/v1/medications/${medLosartanaId}`, undefined, tokenB);
  assert(resCrossGetMed.statusCode === 404, 'Cenário 28: Conta B recebe 404 ao tentar ler medicamento da Conta A');

  // Cenário 29: Conta B não consegue atualizar medicamento da Conta A
  const resCrossPatchMed = await dispatchRequest('PATCH', `/api/v1/medications/${medLosartanaId}`, { name: 'Adulterado' }, tokenB);
  assert(resCrossPatchMed.statusCode === 404, 'Cenário 29: Conta B recebe 404 ao tentar atualizar medicamento da Conta A');

  // Cenário 30: Conta B não consegue excluir medicamento da Conta A
  const resCrossDeleteMed = await dispatchRequest('DELETE', `/api/v1/medications/${medLosartanaId}`, undefined, tokenB);
  assert(resCrossDeleteMed.statusCode === 404, 'Cenário 30: Conta B recebe 404 ao tentar excluir medicamento da Conta A');

  // --------------------------------------------------------------------------
  // GRUPO 3: Domínio de Horários dos Medicamentos
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 3: Domínio de Horários dos Medicamentos ---');

  // Cenário 31: Criar horário válido no formato HH:mm
  const resTime1 = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, {
    time: '08:00',
  }, tokenA);
  assert(resTime1.statusCode === 201 && resTime1.body.time.time === '08:00', 'Cenário 31: Horário 08:00 criado com sucesso (201 Created)');
  const time1Id = resTime1.body.time.id;

  // Cenário 32: Rejeitar formato de horário inválido
  const resTimeBad1 = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '25:00' }, tokenA);
  const resTimeBad2 = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '8:00' }, tokenA);
  const resTimeBad3 = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: 'abc' }, tokenA);
  assert(resTimeBad1.statusCode === 400 && resTimeBad2.statusCode === 400 && resTimeBad3.statusCode === 400, 'Cenário 32: Rejeição de horários inválidos como 25:00, 8:00 e abc (400 Bad Request)');

  // Cenário 33: Rejeitar horário duplicado para o mesmo medicamento ativo
  const resTimeDup = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '08:00' }, tokenA);
  assert(resTimeDup.statusCode === 409 && resTimeDup.body.error === 'Conflict', 'Cenário 33: Bloqueio de horário duplicado para o mesmo medicamento ativo (409 Conflict)');

  // Cenário 34: Rejeitar criação de horário em medicamento inexistente
  const resTimeNoMed = await dispatchRequest('POST', `/api/v1/medications/med_non_existent/times`, { time: '12:00' }, tokenA);
  assert(resTimeNoMed.statusCode === 404, 'Cenário 34: Rejeição de horário para medicamento inexistente (404 Not Found)');

  // Cenário 35: Rejeitar criação de horário em medicamento excluído
  const resTimeDelMed = await dispatchRequest('POST', `/api/v1/medications/${medSinvastatinaId}/times`, { time: '20:00' }, tokenA);
  assert(resTimeDelMed.statusCode === 404, 'Cenário 35: Rejeição de horário para medicamento excluído (404 Not Found)');

  // Cenário 36: Rejeitar criação de horário em medicamento de outra conta
  const resTimeCrossMed = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '10:00' }, tokenB);
  assert(resTimeCrossMed.statusCode === 404, 'Cenário 36: Conta B recebe 404 ao tentar adicionar horário em medicamento da Conta A');

  // Adiciona segundo horário no mesmo medicamento
  const resTime2 = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '20:00' }, tokenA);
  const time2Id = resTime2.body.time.id;

  // Cenário 37: Listar horários ativos de um medicamento em ordem cronológica
  const resListTimes = await dispatchRequest('GET', `/api/v1/medications/${medLosartanaId}/times`, undefined, tokenA);
  assert(
    resListTimes.statusCode === 200 &&
    resListTimes.body.times.length === 2 &&
    resListTimes.body.times[0].time === '08:00' &&
    resListTimes.body.times[1].time === '20:00',
    'Cenário 37: Listagem retornou os horários ordenados cronologicamente (08:00, 20:00)'
  );

  // Cenário 38: Consultar horário por ID
  const resGetTime = await dispatchRequest('GET', `/api/v1/medication-times/${time1Id}`, undefined, tokenA);
  assert(resGetTime.statusCode === 200 && resGetTime.body.time.time === '08:00', 'Cenário 38: Consulta de horário por ID com sucesso (200 OK)');

  // Cenário 39: Atualizar horário
  const resPatchTime = await dispatchRequest('PATCH', `/api/v1/medication-times/${time1Id}`, { time: '08:30' }, tokenA);
  assert(resPatchTime.statusCode === 200 && resPatchTime.body.time.time === '08:30' && resPatchTime.body.time.version === 2, 'Cenário 39: Atualização de horário para 08:30 com incremento de version (200 OK)');

  // Cenário 40: Atualização que colide com outro horário ativo é rejeitada com 409
  const resPatchTimeConflict = await dispatchRequest('PATCH', `/api/v1/medication-times/${time1Id}`, { time: '20:00' }, tokenA);
  assert(resPatchTimeConflict.statusCode === 409, 'Cenário 40: Atualização conflitante com outro horário ativo rejeitada com 409 Conflict');

  // Cenário 41: Excluir logicamente horário
  const resDeleteTime = await dispatchRequest('DELETE', `/api/v1/medication-times/${time2Id}`, undefined, tokenA);
  assert(resDeleteTime.statusCode === 200 && resDeleteTime.body.message.includes('sucesso'), 'Cenário 41: Exclusão lógica de horário concluída com sucesso (200 OK)');

  // Cenário 42: Horário excluído não aparece na listagem do medicamento
  const resListTimesAfterDel = await dispatchRequest('GET', `/api/v1/medications/${medLosartanaId}/times`, undefined, tokenA);
  assert(resListTimesAfterDel.body.times.length === 1 && resListTimesAfterDel.body.times[0].id === time1Id, 'Cenário 42: Horário excluído não consta mais na listagem');

  // Cenário 43: Consulta de horário excluído retorna 404
  const resGetTimeDel = await dispatchRequest('GET', `/api/v1/medication-times/${time2Id}`, undefined, tokenA);
  assert(resGetTimeDel.statusCode === 404, 'Cenário 43: Consulta de horário excluído retorna 404 Not Found');

  // Cenário 44: Re-cadastrar o mesmo horário após exclusão é permitido (20:00 foi liberado)
  const resRecreateTime = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '20:00' }, tokenA);
  assert(resRecreateTime.statusCode === 201, 'Cenário 44: Re-cadastrar horário anteriormente excluído é permitido sem conflito');

  // Cenário 45: Isolamento estrito entre contas - Conta B não consegue consultar, atualizar ou excluir horário da Conta A
  const resCrossGetTime = await dispatchRequest('GET', `/api/v1/medication-times/${time1Id}`, undefined, tokenB);
  const resCrossPatchTime = await dispatchRequest('PATCH', `/api/v1/medication-times/${time1Id}`, { time: '11:00' }, tokenB);
  const resCrossDeleteTime = await dispatchRequest('DELETE', `/api/v1/medication-times/${time1Id}`, undefined, tokenB);
  assert(
    resCrossGetTime.statusCode === 404 &&
    resCrossPatchTime.statusCode === 404 &&
    resCrossDeleteTime.statusCode === 404,
    'Cenário 45: Conta B é impedida de ler, atualizar ou excluir horários da Conta A (404 em todas as operações)'
  );

  // --------------------------------------------------------------------------
  // GRUPO 4: Cancelamento de Ocorrências e Preservação de Histórico
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 4: Cancelamento de Ocorrências e Preservação de Histórico ---');

  // Prepara ocorrências para o time1Id nos diversos status
  const now = Date.now();
  testDb.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status, lease_until, lease_token
    ) VALUES 
      ('occ_t_sched', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-10', '08:30', ${now + 86400000}, 'SCHEDULED', NULL, NULL),
      ('occ_t_failed', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-11', '08:30', ${now + 172800000}, 'DISPATCH_FAILED', NULL, NULL),
      ('occ_t_expired_lease', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-12', '08:30', ${now + 259200000}, 'DISPATCHING', ${now - 1000}, 'old_tok'),
      ('occ_t_active_lease', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-13', '08:30', ${now + 345600000}, 'DISPATCHING', ${now + 50000}, 'active_tok'),
      ('occ_t_confirmed', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-04', '08:30', ${now - 3600000}, 'CONFIRMED', NULL, NULL),
      ('occ_t_dispatched', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-03', '08:30', ${now - 7200000}, 'DISPATCHED', NULL, NULL),
      ('occ_t_missed', '${time1Id}', '${profileDaniloId}', '${accountIdA}', '2026-11-02', '08:30', ${now - 10800000}, 'MISSED', NULL, NULL)
  `).run();

  // Cenário 46: Exclusão de horário cancela ocorrências elegíveis (SCHEDULED, DISPATCH_FAILED, lease expirado)
  const delTimeRes = await dispatchRequest('DELETE', `/api/v1/medication-times/${time1Id}`, undefined, tokenA);
  assert(delTimeRes.statusCode === 200 && delTimeRes.body.cancelledOccurrencesCount === 3, 'Cenário 46: Exclusão de horário cancelou exatamente as 3 ocorrências futuras elegíveis');

  // Cenário 47: Preservação de registros históricos
  const occConfirmed = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_t_confirmed'").get() as any;
  const occDispatched = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_t_dispatched'").get() as any;
  const occMissed = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_t_missed'").get() as any;
  assert(
    occConfirmed.status === 'CONFIRMED' &&
    occDispatched.status === 'DISPATCHED' &&
    occMissed.status === 'MISSED',
    'Cenário 47: Ocorrências históricas CONFIRMED, DISPATCHED e MISSED preservadas intactas'
  );

  // Cenário 48: Proteção de lease ativo em DISPATCHING
  const occActiveLease = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_t_active_lease'").get() as any;
  assert(occActiveLease.status === 'DISPATCHING', 'Cenário 48: Ocorrência com lease ativo em DISPATCHING resguardada contra mutação indevida');

  // Cenário 49: Exclusão de medicamento cancela ocorrências e preserva histórico
  // Insere novo horário e ocorrências para medLosartanaId
  const resTimeForMed = await dispatchRequest('POST', `/api/v1/medications/${medLosartanaId}/times`, { time: '14:00' }, tokenA);
  const timeForMedId = resTimeForMed.body.time.id;
  testDb.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status
    ) VALUES 
      ('occ_med_sched', '${timeForMedId}', '${profileDaniloId}', '${accountIdA}', '2026-11-15', '14:00', ${now + 86400000}, 'SCHEDULED'),
      ('occ_med_conf', '${timeForMedId}', '${profileDaniloId}', '${accountIdA}', '2026-11-01', '14:00', ${now - 86400000}, 'CONFIRMED')
  `).run();

  const delMedRes = await dispatchRequest('DELETE', `/api/v1/medications/${medLosartanaId}`, undefined, tokenA);
  const occMedSchedAfter = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_med_sched'").get() as any;
  const occMedConfAfter = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_med_conf'").get() as any;
  assert(
    delMedRes.statusCode === 200 &&
    occMedSchedAfter.status === 'CANCELLED' &&
    occMedConfAfter.status === 'CONFIRMED',
    'Cenário 49: Exclusão de medicamento cancelou ocorrência futura e preservou a confirmada'
  );

  // Cenário 50: Exclusão de perfil cancela ocorrências de todos os seus medicamentos e preserva histórico
  // Cria novo perfil com medicamento, horário e ocorrências
  const newProfRes = await dispatchRequest('POST', '/api/v1/profiles', { name: 'Perfil Cascatas', avatar: 'avatar.png' }, tokenA);
  const newProfId = newProfRes.body.profile.id;
  const newMedRes = await dispatchRequest('POST', `/api/v1/profiles/${newProfId}/medications`, { name: 'Remédio Cascata' }, tokenA);
  const newMedId = newMedRes.body.medication.id;
  const newTimeRes = await dispatchRequest('POST', `/api/v1/medications/${newMedId}/times`, { time: '16:00' }, tokenA);
  const newTimeId = newTimeRes.body.time.id;
  testDb.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status
    ) VALUES 
      ('occ_prof_sched', '${newTimeId}', '${newProfId}', '${accountIdA}', '2026-11-16', '16:00', ${now + 86400000}, 'SCHEDULED'),
      ('occ_prof_conf', '${newTimeId}', '${newProfId}', '${accountIdA}', '2026-11-02', '16:00', ${now - 86400000}, 'CONFIRMED')
  `).run();

  const delProfRes = await dispatchRequest('DELETE', `/api/v1/profiles/${newProfId}`, undefined, tokenA);
  const occProfSchedAfter = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_prof_sched'").get() as any;
  const occProfConfAfter = testDb.prepare("SELECT status FROM dose_occurrences WHERE id = 'occ_prof_conf'").get() as any;
  assert(
    delProfRes.statusCode === 200 &&
    occProfSchedAfter.status === 'CANCELLED' &&
    occProfConfAfter.status === 'CONFIRMED',
    'Cenário 50: Exclusão de perfil cancelou ocorrências futuras em cascata e preservou históricas'
  );

  // --------------------------------------------------------------------------
  // GRUPO 5: Integridade Composta Direta no SQLite
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 5: Integridade Composta Direta no SQLite ---');

  // Cenário 51: Rejeição direta pelo SQLite em inserção inconsistente
  let sqliteRejected = false;
  try {
    testDb.prepare(`
      INSERT INTO medications (id, profile_id, account_id, name)
      VALUES ('med_violacao', '${profileDaniloId}', '${accountIdB}', 'Remédio Malicioso')
    `).run();
  } catch (err: any) {
    sqliteRejected = err.message.includes('FOREIGN KEY constraint failed');
  }
  assert(sqliteRejected, 'Cenário 51: SQLite rejeitou inserção direta violando FK composta entre perfil e conta');

  // Cenário 52: Verificação global de integridade
  const fkCheck = testDb.pragma('foreign_key_check') as any[];
  assert(fkCheck.length === 0, 'Cenário 52: PRAGMA foreign_key_check confirmou zero violações de integridade no banco');

  console.log('\n================================================================');
  console.log(`  RESULTADO: ${passedTests} de ${totalTests} testes APROVADOS COM SUCESSO!`);
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('Falha catastrófica na suíte de testes:', err);
  process.exit(1);
});
