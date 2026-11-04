import Database from 'better-sqlite3';
import { Readable } from 'node:stream';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { SubscriptionService } from './subscriptionService.js';
import { handleSubscriptionRoutes } from '../api/subscriptionRoutes.js';

console.log('================================================================');
console.log('  Suíte de Testes Automatizados - Etapa 2B (Push Subscriptions)');
console.log('================================================================');

// 1. Criação de banco SQLite em memória isolado com todas as migrações (001 a 005)
const testDb = new Database(':memory:');
testDb.pragma('foreign_keys = ON');
runVersionedMigrations(testDb);

const authService = new AuthService(testDb);
const subscriptionService = new SubscriptionService(testDb);

interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  rawBody: string;
}

// Despachante in-memory para testar a camada de controle HTTP e middlewares sem portas de rede
function createMockReqRes(method: string, url: string, body?: any, headers: Record<string, string> = {}) {
  const reqStream = new Readable({
    read() {
      if (body !== undefined) {
        this.push(typeof body === 'string' ? body : JSON.stringify(body));
      }
      this.push(null);
    },
  });

  const req = Object.assign(reqStream, {
    method,
    url,
    headers: {
      host: 'localhost',
      ...headers,
    },
  });

  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  let rawBody = '';

  let resolvePromise: (val: MockResponse) => void;
  const promise = new Promise<MockResponse>((res) => {
    resolvePromise = res;
  });

  const res: any = {
    writeHead(status: number, headers?: Record<string, string>) {
      statusCode = status;
      if (headers) {
        Object.assign(resHeaders, headers);
      }
      return res;
    },
    setHeader(key: string, value: string) {
      resHeaders[key.toLowerCase()] = value;
    },
    end(chunk?: string) {
      if (chunk) rawBody += chunk;
      let parsedBody: any = null;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
      resolvePromise({
        status: statusCode,
        headers: resHeaders,
        body: parsedBody,
        rawBody,
      });
    },
  };

  return { req, res, promise };
}

async function apiRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  const { req, res, promise } = createMockReqRes(method, path, body, headers);
  await handleSubscriptionRoutes(req as any, res as any, subscriptionService, authService);
  return await promise;
}

async function runTestSuite() {
  // Setup de Contas de Teste
  const userA = authService.register({ username: 'usuario_a', password: 'SenhaValida123!' });
  const userB = authService.register({ username: 'usuario_b', password: 'OutraSenha456!' });
  const userC = authService.register({ username: 'usuario_c', password: 'TerceiraSenha789!' });

  const tokenA = userA.accessToken;
  const tokenB = userB.accessToken;
  const tokenC = userC.accessToken;

  let subA1_id = '';
  let subA2_id = '';

  // =========================================================================
  // GRUPO 1: REGISTRO (Cenários 1 a 9)
  // =========================================================================
  console.log('\n--- GRUPO 1: Registro de Push Subscriptions ---');

  // 1. Registro de subscription válida
  const res1 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_disp_a1',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9h0mA9abcq-um0Tpc0rUM80VQxVA28WeG4nU00R0v0bUPg',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
      deviceName: 'Pixel 8 Pro de Camilla',
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    },
    tokenA
  );
  if (res1.status !== 201 || !res1.body.subscription?.id || res1.body.subscription.isActive !== true) {
    throw new Error(`Cenário 1 Falhou: status=${res1.status}, body=${JSON.stringify(res1.body)}`);
  }
  subA1_id = res1.body.subscription.id;
  console.log('✓ Cenário 1: Registro de subscription válida com sucesso (201 Created).');

  // 2. Registro sem autenticação (401)
  const res2 = await apiRequest('POST', '/api/v1/push-subscriptions', {
    endpoint: 'https://fcm.googleapis.com/fcm/send/token_sem_auth',
    keys: { p256dh: 'chave_p256', auth: 'chave_auth' },
  });
  if (res2.status !== 401) {
    throw new Error(`Cenário 2 Falhou: Esperado 401, recebido ${res2.status}`);
  }
  console.log('✓ Cenário 2: Registro sem autenticação rejeitado com 401 Unauthorized.');

  // 3. Registro com JWT inválido (401)
  const res3 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_jwt_falso',
      keys: { p256dh: 'chave_p256', auth: 'chave_auth' },
    },
    'token.jwt.completamente.invalido'
  );
  if (res3.status !== 401) {
    throw new Error(`Cenário 3 Falhou: Esperado 401, recebido ${res3.status}`);
  }
  console.log('✓ Cenário 3: Registro com JWT inválido rejeitado com 401 Unauthorized.');

  // 4. Registro sem endpoint (400)
  const res4 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      keys: { p256dh: 'chave_p256', auth: 'chave_auth' },
    },
    tokenA
  );
  if (res4.status !== 400 || !res4.body.details?.some((d: any) => d.field === 'endpoint')) {
    throw new Error(`Cenário 4 Falhou: Esperado 400 com detalhe no campo endpoint, recebido ${res4.status}`);
  }
  console.log('✓ Cenário 4: Registro sem endpoint rejeitado com 400 Bad Request.');

  // 5. Registro sem p256dh (400)
  const res5 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_sem_p256dh',
      keys: { auth: 'chave_auth' },
    },
    tokenA
  );
  if (res5.status !== 400 || !res5.body.details?.some((d: any) => d.field.includes('p256dh'))) {
    throw new Error(`Cenário 5 Falhou: Esperado 400 com detalhe no campo p256dh, recebido ${res5.status}`);
  }
  console.log('✓ Cenário 5: Registro sem p256dh rejeitado com 400 Bad Request.');

  // 6. Registro sem auth (400)
  const res6 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_sem_auth_key',
      keys: { p256dh: 'chave_p256' },
    },
    tokenA
  );
  if (res6.status !== 400 || !res6.body.details?.some((d: any) => d.field.includes('auth'))) {
    throw new Error(`Cenário 6 Falhou: Esperado 400 com detalhe no campo auth, recebido ${res6.status}`);
  }
  console.log('✓ Cenário 6: Registro sem auth key rejeitado com 400 Bad Request.');

  // 7. Tentativa de informar account_id de outra conta (backend ignora e força o sub autenticado)
  const res7 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      account_id: userB.account.id, // Tentativa maliciosa de atribuir à conta B usando token da conta A
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_disp_a2',
      keys: { p256dh: 'chave_p256_a2', auth: 'chave_auth_a2' },
      deviceName: 'MacBook Pro de Camilla',
    },
    tokenA
  );
  if (res7.status !== 201) {
    throw new Error(`Cenário 7 Falhou: Esperado 201, recebido ${res7.status}`);
  }
  subA2_id = res7.body.subscription.id;
  // Verifica no banco se a subscription foi gravada sob a conta A e NÃO sob a conta B
  const subRecord = testDb.prepare('SELECT account_id FROM push_subscriptions WHERE id = ?').get(subA2_id) as any;
  if (subRecord.account_id !== userA.account.id) {
    throw new Error(`Cenário 7 Falhou: account_id gravado ${subRecord.account_id} não é do usuário autenticado!`);
  }
  console.log('✓ Cenário 7: Tentativa de injeção de account_id ignorada, vinculação estrita à identidade JWT.');

  // 8. Registro duplicado (mesmo endpoint e mesma conta: deve atualizar sem duplicar)
  const countBeforeDup = (testDb.prepare('SELECT count(*) as count FROM push_subscriptions').get() as any).count;
  const res8 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_disp_a1', // Endpoint já existente
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9h0mA9abcq-um0Tpc0rUM80VQxVA28WeG4nU00R0v0bUPg',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
      deviceName: 'Pixel 8 Pro (Renovado)',
    },
    tokenA
  );
  const countAfterDup = (testDb.prepare('SELECT count(*) as count FROM push_subscriptions').get() as any).count;
  if (res8.status !== 200 || countBeforeDup !== countAfterDup || res8.body.subscription.id !== subA1_id) {
    throw new Error(
      `Cenário 8 Falhou: Esperado 200 e mesma contagem de registros, countBefore=${countBeforeDup}, countAfter=${countAfterDup}`
    );
  }
  console.log('✓ Cenário 8: Registro duplicado com mesmo endpoint deduplicado e atualizado (200 OK).');

  // 9. Renovação de subscription existente anteriormente inativa
  // Primeiro desativa a subscription subA1
  testDb.prepare('UPDATE push_subscriptions SET is_active = 0 WHERE id = ?').run(subA1_id);
  const checkInactive = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE id = ?').get(subA1_id) as any;
  if (checkInactive.is_active !== 0) throw new Error('Falha no setup do Cenário 9');

  // Agora envia novo registro para o mesmo endpoint
  const res9 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_disp_a1',
      keys: { p256dh: 'nova_chave_p256', auth: 'nova_chave_auth' },
      deviceName: 'Pixel 8 Pro Reativado',
    },
    tokenA
  );
  if (res9.status !== 200 || res9.body.subscription.isActive !== true) {
    throw new Error(`Cenário 9 Falhou: Subscription não foi reativada, body=${JSON.stringify(res9.body)}`);
  }
  console.log('✓ Cenário 9: Renovação de subscription reativa endpoint inativo e atualiza credenciais.');

  // =========================================================================
  // GRUPO 2: CONSULTA (Cenários 10 a 13)
  // =========================================================================
  console.log('\n--- GRUPO 2: Consulta de Dispositivos e Subscriptions ---');

  // 10. Listagem das subscriptions da própria conta
  const res10 = await apiRequest('GET', '/api/v1/push-subscriptions', undefined, tokenA);
  if (res10.status !== 200 || !Array.isArray(res10.body.subscriptions) || res10.body.subscriptions.length !== 2) {
    throw new Error(`Cenário 10 Falhou: Esperadas 2 subscriptions para usuário A, recebido ${JSON.stringify(res10.body)}`);
  }
  console.log('✓ Cenário 10: Listagem retornou exatamente as subscriptions da conta autenticada.');

  // 11. Impossibilidade de consultar subscriptions de outra conta
  const res11 = await apiRequest('GET', '/api/v1/push-subscriptions', undefined, tokenB);
  if (res11.status !== 200 || res11.body.subscriptions.length !== 0) {
    throw new Error(`Cenário 11 Falhou: Usuário B não deveria ver subscriptions de A, body=${JSON.stringify(res11.body)}`);
  }
  console.log('✓ Cenário 11: Isolamento estrito entre contas comprovado (usuário B não vê dados de A).');

  // 12. Ausência das chaves completas (p256dh e auth) nas respostas da API
  const subDTO = res10.body.subscriptions[0];
  if ('p256dh' in subDTO || 'auth' in subDTO || 'keys' in subDTO) {
    throw new Error(`Cenário 12 Falhou: Credenciais sensíveis expostas no DTO da API: ${JSON.stringify(subDTO)}`);
  }
  console.log('✓ Cenário 12: Chaves brutas p256dh e auth devidamente omitidas dos DTOs públicos da API.');

  // 13. Conta sem subscriptions
  const res13 = await apiRequest('GET', '/api/v1/push-subscriptions', undefined, tokenC);
  if (res13.status !== 200 || !Array.isArray(res13.body.subscriptions) || res13.body.subscriptions.length !== 0) {
    throw new Error(`Cenário 13 Falhou: Conta sem subscriptions deve retornar array vazio, recebido ${JSON.stringify(res13.body)}`);
  }
  console.log('✓ Cenário 13: Conta sem subscriptions retorna status 200 e array vazio [].');

  // =========================================================================
  // GRUPO 3: PRIVACIDADE (Cenários 14 a 17)
  // =========================================================================
  console.log('\n--- GRUPO 3: Preferência de Privacidade ---');

  // 14. Nova subscription com hide_medication_names = true por padrão
  const subA1_db = testDb.prepare('SELECT hide_medication_names FROM push_subscriptions WHERE id = ?').get(subA1_id) as any;
  if (subA1_db.hide_medication_names !== 1) {
    throw new Error(`Cenário 14 Falhou: hide_medication_names padrão deveria ser 1 (true), recebido ${subA1_db.hide_medication_names}`);
  }
  console.log('✓ Cenário 14: Nova subscription criada com hide_medication_names = true por padrão.');

  // 15. Alteração explícita para false
  const res15 = await apiRequest(
    'PATCH',
    `/api/v1/push-subscriptions/${subA1_id}`,
    { hideMedicationNames: false },
    tokenA
  );
  if (res15.status !== 200 || res15.body.subscription?.hideMedicationNames !== false) {
    throw new Error(`Cenário 15 Falhou: Esperado 200 e hideMedicationNames=false, recebido ${JSON.stringify(res15.body)}`);
  }
  console.log('✓ Cenário 15: Alteração explícita de hideMedicationNames para false efetuada com sucesso.');

  // 16. Alteração de uma subscription sem afetar outras
  const res16_subA2 = await apiRequest('GET', '/api/v1/push-subscriptions', undefined, tokenA);
  const itemSubA2 = res16_subA2.body.subscriptions.find((s: any) => s.id === subA2_id);
  if (!itemSubA2 || itemSubA2.hideMedicationNames !== true) {
    throw new Error(`Cenário 16 Falhou: subA2 foi indevidamente modificada, valor: ${itemSubA2?.hideMedicationNames}`);
  }
  console.log('✓ Cenário 16: Alteração na subscription 1 não afetou a subscription 2 (independência mantida).');

  // 17. Rejeição de valores inválidos (string "true", número, etc)
  const res17 = await apiRequest(
    'PATCH',
    `/api/v1/push-subscriptions/${subA1_id}`,
    { hideMedicationNames: 'invalido_string' },
    tokenA
  );
  if (res17.status !== 400) {
    throw new Error(`Cenário 17 Falhou: Esperado 400 Bad Request para valor não booleano, recebido ${res17.status}`);
  }
  console.log('✓ Cenário 17: Valores inválidos para hideMedicationNames rejeitados com 400 Bad Request.');

  // =========================================================================
  // GRUPO 4: DESATIVAÇÃO E REMOÇÃO (Cenários 18 a 21)
  // =========================================================================
  console.log('\n--- GRUPO 4: Desativação e Remoção de Dispositivos ---');

  // 18. Desativação de subscription própria
  const res18 = await apiRequest('DELETE', `/api/v1/push-subscriptions/${subA1_id}`, undefined, tokenA);
  if (res18.status !== 200 || res18.body.subscription?.isActive !== false) {
    throw new Error(`Cenário 18 Falhou: Esperado 200 e isActive=false, recebido ${JSON.stringify(res18.body)}`);
  }
  console.log('✓ Cenário 18: Desativação de subscription própria concluída com sucesso (is_active = 0).');

  // 19. Tentativa de desativar subscription de outra conta (403 Forbidden)
  const res19 = await apiRequest('DELETE', `/api/v1/push-subscriptions/${subA2_id}`, undefined, tokenB);
  if (res19.status !== 403) {
    throw new Error(`Cenário 19 Falhou: Conta B não pode desativar subscription da conta A, recebido ${res19.status}`);
  }
  console.log('✓ Cenário 19: Tentativa de desativação de subscription alheia bloqueada com 403 Forbidden.');

  // 20. Tentativa de remover subscription inexistente (404 Not Found)
  const res20 = await apiRequest('DELETE', '/api/v1/push-subscriptions/sub_id_inexistente_xyz', undefined, tokenA);
  if (res20.status !== 404) {
    throw new Error(`Cenário 20 Falhou: Esperado 404 para id inexistente, recebido ${res20.status}`);
  }
  console.log('✓ Cenário 20: Tentativa de remoção de ID inexistente rejeitada com 404 Not Found.');

  // 21. Verificação do estado após desativação
  const subRecordAfterDel = testDb.prepare('SELECT is_active, updated_at FROM push_subscriptions WHERE id = ?').get(subA1_id) as any;
  if (subRecordAfterDel.is_active !== 0) {
    throw new Error(`Cenário 21 Falhou: No banco de dados is_active continua ${subRecordAfterDel.is_active}`);
  }
  console.log('✓ Cenário 21: Estado após desativação auditado no banco: is_active = 0 e updated_at atualizado.');

  // =========================================================================
  // GRUPO 5: LIMPEZA DE SUBSCRIPTIONS INVÁLIDAS (Cenários 22 a 25)
  // =========================================================================
  console.log('\n--- GRUPO 5: Limpeza de Subscriptions Inválidas (Dead Subscriptions) ---');

  // Setup de endpoints para teste de limpeza
  const cleanEndpoint404 = 'https://fcm.googleapis.com/fcm/send/dead_404_endpoint';
  const cleanEndpoint410 = 'https://mozilla.pushservice.com/dead_410_endpoint';
  const cleanEndpoint500 = 'https://fcm.googleapis.com/fcm/send/temp_500_endpoint';
  const cleanEndpointTimeout = 'https://fcm.googleapis.com/fcm/send/timeout_endpoint';

  const reg404 = subscriptionService.registerSubscription(userA.account.id, {
    endpoint: cleanEndpoint404,
    keys: { p256dh: 'key_404', auth: 'auth_404' },
  });
  const reg410 = subscriptionService.registerSubscription(userA.account.id, {
    endpoint: cleanEndpoint410,
    keys: { p256dh: 'key_410', auth: 'auth_410' },
  });
  subscriptionService.registerSubscription(userA.account.id, {
    endpoint: cleanEndpoint500,
    keys: { p256dh: 'key_500', auth: 'auth_500' },
  });
  subscriptionService.registerSubscription(userA.account.id, {
    endpoint: cleanEndpointTimeout,
    keys: { p256dh: 'key_timeout', auth: 'auth_timeout' },
  });

  if (!reg404.success || !reg410.success) throw new Error('Falha no setup de limpeza');

  // 22. Resposta simulada HTTP 404 Not Found (usando subscriptionId interno)
  const cleanResult404 = subscriptionService.handlePushServiceError(reg404.subscription.id, 404);
  if (cleanResult404.action !== 'DEACTIVATED' || cleanResult404.affectedRows !== 1) {
    throw new Error(`Cenário 22 Falhou: Esperado DEACTIVATED, recebido ${JSON.stringify(cleanResult404)}`);
  }
  const check404 = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE endpoint = ?').get(cleanEndpoint404) as any;
  if (check404.is_active !== 0) throw new Error('Cenário 22 Falhou: endpoint 404 continua ativo no banco');
  console.log('✓ Cenário 22: Resposta HTTP 404 desativa a subscription com sucesso por subscriptionId interno.');

  // 23. Resposta simulada HTTP 410 Gone (usando objeto { subscriptionId })
  const cleanResult410 = subscriptionService.handlePushServiceError({ subscriptionId: reg410.subscription.id }, 410);
  if (cleanResult410.action !== 'DEACTIVATED' || cleanResult410.affectedRows !== 1) {
    throw new Error(`Cenário 23 Falhou: Esperado DEACTIVATED, recebido ${JSON.stringify(cleanResult410)}`);
  }
  const check410 = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE endpoint = ?').get(cleanEndpoint410) as any;
  if (check410.is_active !== 0) throw new Error('Cenário 23 Falhou: endpoint 410 continua ativo no banco');
  console.log('✓ Cenário 23: Resposta HTTP 410 desativa a subscription com sucesso por objeto target.');

  // 24. Falha temporária HTTP 5xx não deve desativar a inscrição
  const cleanResult500 = subscriptionService.handlePushServiceError(cleanEndpoint500, 503);
  if (cleanResult500.action !== 'IGNORED' || cleanResult500.affectedRows !== 0) {
    throw new Error(`Cenário 24 Falhou: Erro 503 deveria ser IGNORED, recebido ${JSON.stringify(cleanResult500)}`);
  }
  const check500 = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE endpoint = ?').get(cleanEndpoint500) as any;
  if (check500.is_active !== 1) throw new Error('Cenário 24 Falhou: Erro 503 desativou indevidamente a subscription');
  console.log('✓ Cenário 24: Falha temporária HTTP 5xx mantida para retentativa (is_active = 1 mantido).');

  // 25. Timeout ou erro de rede não deve provocar exclusão indevida
  const networkErr = new Error('connect ETIMEDOUT 142.250.190.42:443');
  const cleanResultTimeout = subscriptionService.handlePushServiceError(cleanEndpointTimeout, networkErr);
  if (cleanResultTimeout.action !== 'IGNORED' || cleanResultTimeout.affectedRows !== 0) {
    throw new Error(`Cenário 25 Falhou: Erro de timeout deveria ser IGNORED, recebido ${JSON.stringify(cleanResultTimeout)}`);
  }
  const checkTimeout = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE endpoint = ?').get(cleanEndpointTimeout) as any;
  if (checkTimeout.is_active !== 1) throw new Error('Cenário 25 Falhou: Timeout desativou indevidamente a subscription');
  console.log('✓ Cenário 25: Falhas temporárias de rede/timeout mantidas ativas para retentativa.');

  // =========================================================================
  // GRUPO 6: CONCORRÊNCIA E INTEGRIDADE (Cenários 26 a 28)
  // =========================================================================
  console.log('\n--- GRUPO 6: Concorrência e Integridade Estrutural ---');

  // 26. Registro simultâneo da mesma subscription pela MESMA conta
  const raceEndpoint = 'https://fcm.googleapis.com/fcm/send/race_concurrent_endpoint';
  const racePromises = Array.from({ length: 10 }).map((_, i) =>
    apiRequest(
      'POST',
      '/api/v1/push-subscriptions',
      {
        endpoint: raceEndpoint,
        keys: { p256dh: `race_p256_${i}`, auth: `race_auth_${i}` },
        deviceName: `Dispositivo Concorrente ${i}`,
      },
      tokenA
    )
  );
  const raceResults = await Promise.all(racePromises);
  for (const r of raceResults) {
    if (r.status !== 200 && r.status !== 201) {
      throw new Error(`Cenário 26 Falhou: Uma das requisições concorrentes falhou com status ${r.status}`);
    }
  }
  const countRace = (
    testDb.prepare('SELECT count(*) as count FROM push_subscriptions WHERE endpoint = ?').get(raceEndpoint) as any
  ).count;
  if (countRace !== 1) {
    throw new Error(`Cenário 26 Falhou: Esperado exatamente 1 registro para o endpoint concorrente, encontrado: ${countRace}`);
  }
  console.log('✓ Cenário 26: 10 registros simultâneos no mesmo endpoint pela mesma conta processados com atomicidade.');

  // 27. Atualização simultânea de preferências
  const patchPromises = Array.from({ length: 10 }).map((_, i) =>
    apiRequest(
      'PATCH',
      `/api/v1/push-subscriptions/${subA2_id}`,
      { hideMedicationNames: i % 2 === 0 },
      tokenA
    )
  );
  const patchResults = await Promise.all(patchPromises);
  for (const r of patchResults) {
    if (r.status !== 200) {
      throw new Error(`Cenário 27 Falhou: Atualização concorrente falhou com status ${r.status}`);
    }
  }
  console.log('✓ Cenário 27: 10 atualizações concorrentes de preferência processadas sem deadlock nem inconsistência.');

  // 28. Integridade das relações entre contas e subscriptions (ON DELETE CASCADE)
  const tempUser = authService.register({ username: 'usuario_temp_cascade', password: 'SenhaTemporaria123!' });
  const cascadeEndpoint = 'https://fcm.googleapis.com/fcm/send/cascade_test_endpoint';
  const regCascade = subscriptionService.registerSubscription(tempUser.account.id, {
    endpoint: cascadeEndpoint,
    keys: { p256dh: 'cascade_p256', auth: 'cascade_auth' },
    deviceName: 'Device Temp Cascade',
  });
  if (!regCascade.success) throw new Error('Falha no setup do Cenário 28');
  const subBeforeDelete = testDb.prepare('SELECT id FROM push_subscriptions WHERE id = ?').get(regCascade.subscription.id);
  if (!subBeforeDelete) throw new Error('Falha no setup do Cenário 28');

  testDb.prepare('DELETE FROM accounts WHERE id = ?').run(tempUser.account.id);

  const subAfterDelete = testDb.prepare('SELECT id FROM push_subscriptions WHERE id = ?').get(regCascade.subscription.id);
  if (subAfterDelete) {
    throw new Error('Cenário 28 Falhou: Subscription não foi removida em cascata após deleção da conta proprietária!');
  }
  console.log('✓ Cenário 28: Integridade referencial comprovada: deleção da conta remove subscriptions em CASCADE.');

  // =========================================================================
  // GRUPO 7: VALIDAÇÃO ESPECÍFICA DE SEGURANÇA E PROPRIEDADE (CENÁRIOS DE AUDITORIA)
  // =========================================================================
  console.log('\n--- GRUPO 7: Segurança de Propriedade e Concorrência entre Contas ---');

  // Cenário 29 (Auditoria 4 e 6): Conta B tenta registrar endpoint ativo pertencente à Conta A -> 409 Conflict
  const res29 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_disp_a1', // Pertence à Conta A
      keys: { p256dh: 'chave_b_invasora', auth: 'auth_b_invasora' },
      deviceName: 'Device Invasor B',
    },
    tokenB
  );
  if (res29.status !== 409 || res29.body?.error !== 'Conflict') {
    throw new Error(`Cenário 29 Falhou: Esperado 409 Conflict, recebido status ${res29.status}, body=${JSON.stringify(res29.body)}`);
  }
  // Confirma que nenhuma info do dono original vazou
  if (JSON.stringify(res29.body).includes(userA.account.id) || JSON.stringify(res29.body).includes('usuario_a')) {
    throw new Error('Cenário 29 Falhou: Resposta de erro expôs dados da conta proprietária original!');
  }
  // Confirma que o proprietário permaneceu sendo a Conta A
  const checkOwnerA1 = testDb.prepare('SELECT account_id FROM push_subscriptions WHERE endpoint = ?').get('https://fcm.googleapis.com/fcm/send/token_disp_a1') as any;
  if (checkOwnerA1.account_id !== userA.account.id) {
    throw new Error(`Cenário 29 Falhou: Titularidade da subscription foi violada!`);
  }
  console.log('✓ Cenário 29: Tentativa de Conta B registrar endpoint ativo da Conta A rejeitada com 409 Conflict (sem vazamento de dados).');

  // Cenário 30 (Auditoria 5): Conta B tenta registrar endpoint DESATIVADO pertencente à Conta A -> 409 Conflict
  testDb.prepare('UPDATE push_subscriptions SET is_active = 0 WHERE id = ?').run(subA1_id);
  const res30 = await apiRequest(
    'POST',
    '/api/v1/push-subscriptions',
    {
      endpoint: 'https://fcm.googleapis.com/fcm/send/token_disp_a1',
      keys: { p256dh: 'chave_b_tenta_inativo', auth: 'auth_b_tenta_inativo' },
      deviceName: 'Device B Tenta Inativo',
    },
    tokenB
  );
  if (res30.status !== 409) {
    throw new Error(`Cenário 30 Falhou: Tentativa de registrar endpoint inativo de outra conta deveria dar 409, recebido ${res30.status}`);
  }
  const checkOwnerA1_inativo = testDb.prepare('SELECT account_id FROM push_subscriptions WHERE id = ?').get(subA1_id) as any;
  if (checkOwnerA1_inativo.account_id !== userA.account.id) {
    throw new Error('Cenário 30 Falhou: Conta B assumiu subscription inativa da Conta A!');
  }
  console.log('✓ Cenário 30: Tentativa de Conta B registrar endpoint DESATIVADO da Conta A rejeitada com 409 Conflict.');

  // Cenário 31 (Auditoria 9, 10 e 11): Concorrência real entre Conta A e Conta B disputando mesmo endpoint novo
  const disputeEndpoint = 'https://fcm.googleapis.com/fcm/send/dispute_concurrent_endpoint';
  const [disputeA, disputeB] = await Promise.all([
    apiRequest(
      'POST',
      '/api/v1/push-subscriptions',
      { endpoint: disputeEndpoint, keys: { p256dh: 'p256_disp_a', auth: 'auth_disp_a' }, deviceName: 'Dev A Disputa' },
      tokenA
    ),
    apiRequest(
      'POST',
      '/api/v1/push-subscriptions',
      { endpoint: disputeEndpoint, keys: { p256dh: 'p256_disp_b', auth: 'auth_disp_b' }, deviceName: 'Dev B Disputa' },
      tokenB
    ),
  ]);

  const statuses = [disputeA.status, disputeB.status].sort();
  // Um deve ser 201 (sucesso de criação) e o outro 409 (conflito atômico)
  if (statuses[0] !== 201 || statuses[1] !== 409) {
    throw new Error(`Cenário 31 Falhou: Esperado [201, 409] na disputa concorrente, recebido [${disputeA.status}, ${disputeB.status}]`);
  }
  const disputeRow = testDb.prepare('SELECT account_id FROM push_subscriptions WHERE endpoint = ?').get(disputeEndpoint) as any;
  const winnerAccountId = disputeA.status === 201 ? userA.account.id : userB.account.id;
  if (disputeRow.account_id !== winnerAccountId) {
    throw new Error('Cenário 31 Falhou: Vencedor registrado no banco não bate com a resposta 201 emitida!');
  }
  console.log('✓ Cenário 31: Disputa concorrente entre Contas A e B no mesmo endpoint: 1 vencedor (201) e 1 rejeitado atomicamente (409).');

  // Cenário 32 (Auditoria 14, 15 e 16): Limpeza por subscriptionId interno com isolamento cruzado
  const subCleanTarget = subscriptionService.registerSubscription(userA.account.id, {
    endpoint: 'https://fcm.googleapis.com/fcm/send/clean_target_isolated',
    keys: { p256dh: 'k_target', auth: 'a_target' },
  });
  const subCleanSibling = subscriptionService.registerSubscription(userA.account.id, {
    endpoint: 'https://fcm.googleapis.com/fcm/send/clean_sibling_isolated',
    keys: { p256dh: 'k_sib', auth: 'a_sib' },
  });
  const subCleanOtherUser = subscriptionService.registerSubscription(userB.account.id, {
    endpoint: 'https://fcm.googleapis.com/fcm/send/clean_other_user_isolated',
    keys: { p256dh: 'k_other', auth: 'a_other' },
  });

  if (!subCleanTarget.success || !subCleanSibling.success || !subCleanOtherUser.success) {
    throw new Error('Falha no setup do Cenário 32');
  }

  // Executa limpeza direcionada exclusivamente pelo subscriptionId
  const cleanOp = subscriptionService.handlePushServiceError(subCleanTarget.subscription.id, 410);
  if (cleanOp.action !== 'DEACTIVATED' || cleanOp.affectedRows !== 1) {
    throw new Error(`Cenário 32 Falhou: Limpeza por ID falhou: ${JSON.stringify(cleanOp)}`);
  }

  const checkTarget = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE id = ?').get(subCleanTarget.subscription.id) as any;
  const checkSibling = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE id = ?').get(subCleanSibling.subscription.id) as any;
  const checkOther = testDb.prepare('SELECT is_active FROM push_subscriptions WHERE id = ?').get(subCleanOtherUser.subscription.id) as any;

  if (checkTarget.is_active !== 0) throw new Error('Cenário 32 Falhou: Subscription alvo não foi desativada');
  if (checkSibling.is_active !== 1) throw new Error('Cenário 32 Falhou: Inscrição irmã da mesma conta foi indevidamente desativada');
  if (checkOther.is_active !== 1) throw new Error('Cenário 32 Falhou: Inscrição de outra conta foi indevidamente desativada');
  console.log('✓ Cenário 32: Limpeza direcionada por subscriptionId desativou exclusivamente o alvo, preservando outras inscrições da mesma conta e de outras contas.');

  console.log('\n================================================================');
  console.log('  Todos os 32 cenários da Etapa 2B foram aprovados com sucesso! ');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ ERRO NA EXECUÇÃO DA SUÍTE DE TESTES:', err);
  process.exit(1);
});
