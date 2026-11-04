import { Readable } from 'node:stream';
import { formatInTimeZone } from 'date-fns-tz';
import { getDatabase } from '../src/db/connection.js';
import { runVersionedMigrations } from '../src/db/migrator.js';
import { AuthService } from '../src/services/authService.js';
import { ProfileService } from '../src/services/profileService.js';
import { MedicationService } from '../src/services/medicationService.js';
import { MedicationTimeService } from '../src/services/medicationTimeService.js';
import { handleAuthRoutes } from '../src/api/authRoutes.js';
import { handleProfileRoutes } from '../src/api/profileRoutes.js';
import { handleMedicationRoutes } from '../src/api/medicationRoutes.js';
import { env } from '../src/config/env.js';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

function createMockReqRes(method: string, url: string, body?: any, token?: string) {
  const reqStream = new Readable({
    read() {
      if (body) {
        this.push(JSON.stringify(body));
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
    socket: { remoteAddress: '127.0.0.1' },
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
      });
    },
  } as any;

  return { req, res, getResponse: () => promise };
}

async function main() {
  console.log('================================================================');
  console.log('  Preparação de Dados de Teste via API Autenticada (Homologação) ');
  console.log('================================================================\n');

  const db = getDatabase();
  runVersionedMigrations(db);

  const authService = new AuthService(db);
  const profileService = new ProfileService(db);
  const medicationService = new MedicationService(db);
  const medicationTimeService = new MedicationTimeService(db);

  async function dispatchRequest(method: string, url: string, body?: any, token?: string): Promise<MockResponse> {
    const { req, res, getResponse } = createMockReqRes(method, url, body, token);
    const urlObj = new URL(url, 'http://localhost');

    if (urlObj.pathname.startsWith('/api/v1/auth')) {
      await handleAuthRoutes(req, res, authService);
    } else if (urlObj.pathname.startsWith('/api/v1/profiles')) {
      await handleProfileRoutes(req, res, profileService, medicationService, authService);
    } else if (urlObj.pathname.startsWith('/api/v1/medications') || urlObj.pathname.startsWith('/api/v1/medication-times')) {
      await handleMedicationRoutes(req, res, medicationService, medicationTimeService, authService);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }

    return getResponse();
  }

  const username = 'usuario_homologacao';
  const password = 'Password123!';

  // 1. Cadastrar ou autenticar a conta
  console.log(`[1/4] Autenticando/Registrando conta "${username}"...`);
  let token = '';
  let accountId = '';

  const regRes = await dispatchRequest('POST', '/api/v1/auth/register', {
    username,
    password,
    deviceName: 'MacBook Homologação',
  });

  if (regRes.statusCode === 201) {
    console.log('✓ Conta registrada com sucesso (201 Created)');
    token = regRes.body.accessToken;
    accountId = regRes.body.account.id;
  } else if (regRes.statusCode === 409) {
    console.log('✓ Conta já existente, autenticando via login (200 OK)');
    const loginRes = await dispatchRequest('POST', '/api/v1/auth/login', {
      username,
      password,
    });
    if (loginRes.statusCode !== 200) {
      throw new Error(`Falha no login: ${JSON.stringify(loginRes.body)}`);
    }
    token = loginRes.body.accessToken;
    accountId = loginRes.body.account.id;
  } else {
    throw new Error(`Erro inesperado no cadastro: ${JSON.stringify(regRes.body)}`);
  }

  // 2. Verificar ou criar Perfil
  console.log(`\n[2/4] Verificando perfis existentes para a conta...`);
  const listProfRes = await dispatchRequest('GET', '/api/v1/profiles', undefined, token);
  let profileId = '';

  if (listProfRes.statusCode === 200 && Array.isArray(listProfRes.body.profiles) && listProfRes.body.profiles.length > 0) {
    profileId = listProfRes.body.profiles[0].id;
    console.log(`✓ Utilizando perfil existente: "${listProfRes.body.profiles[0].name}" (ID: ${profileId})`);
  } else {
    console.log('Criando novo perfil "Danillo"...');
    const createProfRes = await dispatchRequest('POST', '/api/v1/profiles', {
      name: 'Danillo',
      surname: 'Almeida',
      avatar: 'avatar_1',
      isMainProfile: true,
    }, token);

    if (createProfRes.statusCode !== 201) {
      throw new Error(`Falha ao criar perfil: ${JSON.stringify(createProfRes.body)}`);
    }
    profileId = createProfRes.body.profile.id;
    console.log(`✓ Perfil criado com sucesso: (ID: ${profileId})`);
  }

  // 3. Verificar ou criar Medicamento
  console.log(`\n[3/4] Verificando medicamentos para o perfil...`);
  const listMedsRes = await dispatchRequest('GET', `/api/v1/profiles/${profileId}/medications`, undefined, token);
  let medicationId = '';

  if (listMedsRes.statusCode === 200 && Array.isArray(listMedsRes.body.medications) && listMedsRes.body.medications.length > 0) {
    medicationId = listMedsRes.body.medications[0].id;
    console.log(`✓ Utilizando medicamento existente: "${listMedsRes.body.medications[0].name}" (ID: ${medicationId})`);
  } else {
    console.log('Criando medicamento "Dipirona 500mg" com recorrência DAILY...');
    const createMedRes = await dispatchRequest('POST', `/api/v1/profiles/${profileId}/medications`, {
      name: 'Dipirona 500mg',
      dosage: '1 comprimido',
      recurrence: 'DAILY',
    }, token);

    if (createMedRes.statusCode !== 201) {
      throw new Error(`Falha ao criar medicamento: ${JSON.stringify(createMedRes.body)}`);
    }
    medicationId = createMedRes.body.medication.id;
    console.log(`✓ Medicamento criado com sucesso: (ID: ${medicationId})`);
  }

  // 4. Configurar Horário Imediatamente Vencido
  // Horário local America/Sao_Paulo: definimos para alguns minutos atrás (ex: 10 min atrás)
  const now = new Date();
  const pastMs = now.getTime() - 10 * 60 * 1000;
  const targetTime = formatInTimeZone(new Date(pastMs), env.APP_TIMEZONE, 'HH:mm');
  console.log(`\n[4/4] Verificando horários do medicamento... (Horário alvo imediatamente vencido: ${targetTime})`);

  const listTimesRes = await dispatchRequest('GET', `/api/v1/medications/${medicationId}/times`, undefined, token);
  let timeId = '';

  let existingTime = null;
  if (listTimesRes.statusCode === 200 && Array.isArray(listTimesRes.body.times)) {
    existingTime = listTimesRes.body.times.find((t: any) => t.time === targetTime);
  }

  if (existingTime) {
    timeId = existingTime.id;
    console.log(`✓ Horário ${targetTime} já cadastrado (ID: ${timeId})`);
  } else {
    const createTimeRes = await dispatchRequest('POST', `/api/v1/medications/${medicationId}/times`, {
      time: targetTime,
    }, token);

    if (createTimeRes.statusCode !== 201) {
      throw new Error(`Falha ao criar horário: ${JSON.stringify(createTimeRes.body)}`);
    }
    timeId = createTimeRes.body.time.id;
    console.log(`✓ Horário ${targetTime} cadastrado com sucesso (ID: ${timeId})`);
  }

  console.log('\n================================================================');
  console.log('                 DADOS DE TESTE PREPARADOS                      ');
  console.log('================================================================');
  console.log(`• Usuário: ${username}`);
  console.log(`• Senha: ${password}`);
  console.log(`• Account ID: ${accountId}`);
  console.log(`• Profile ID: ${profileId}`);
  console.log(`• Medication ID: ${medicationId}`);
  console.log(`• Medication Time: ${targetTime} (ID: ${timeId})`);
  console.log(`• JWT Token obtido: Sim (${token.slice(0, 15)}...)`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
