import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import http from 'node:http';
import { runVersionedMigrations } from '../db/migrator.js';
import { AuthService } from './authService.js';
import { ProfileService } from './profileService.js';
import { MedicationService } from './medicationService.js';
import { OccurrenceService } from './occurrenceService.js';
import { PrescriptionService } from './prescriptionService.js';
import { handleProfileRoutes } from '../api/profileRoutes.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runVersionedMigrations(db);
  return db;
}

test('Receitas Médicas e Dados Clínicos no SQLite — Backend', async (t) => {
  const db = createTestDatabase();
  const authService = new AuthService(db);
  const profileService = new ProfileService(db);
  const medicationService = new MedicationService(db);
  const occurrenceService = new OccurrenceService(db, 'America/Sao_Paulo');
  const prescriptionService = new PrescriptionService(db);

  // Setup: Contas A e B
  const accA = authService.register({ username: 'usuario_presc_a', password: 'SenhaForte123!' });
  const profA = profileService.createProfile(accA.account.id, {
    name: 'Camilla',
    surname: 'Silva',
    avatar: 'young-woman',
    isMainProfile: true,
    age: 42,
    weight: 63,
    height: 165,
    medicalConditions: 'Menopausa',
    allergies: 'Nenhuma',
  });

  const accB = authService.register({ username: 'usuario_presc_b', password: 'SenhaForte123!' });
  const profB = profileService.createProfile(accB.account.id, {
    name: 'José',
    surname: 'Ferreira',
    avatar: 'senior-person',
    isMainProfile: true,
    age: 74,
    weight: 76,
    height: 172,
    medicalConditions: 'Parkinson',
    allergies: 'Camarão, Amendoim',
  });

  await t.test('1. Deve persistir e recuperar dados clínicos e físicos nos perfis', () => {
    const fetchedA = profileService.getProfileById(accA.account.id, profA.id);
    assert.ok(fetchedA);
    assert.equal(fetchedA.age, 42);
    assert.equal(fetchedA.weight, 63);
    assert.equal(fetchedA.height, 165);
    assert.equal(fetchedA.medicalConditions, 'Menopausa');
    assert.equal(fetchedA.allergies, 'Nenhuma');

    // Atualiza dados clínicos do perfil B
    const updatedB = profileService.updateProfile(accB.account.id, profB.id, {
      age: 75,
      weight: 78,
      medicalConditions: 'Parkinson Avançado',
      allergies: 'Camarão, Amendoim, Dipirona',
    });
    assert.ok(updatedB);
    assert.equal(updatedB.age, 75);
    assert.equal(updatedB.weight, 78);
    assert.equal(updatedB.medicalConditions, 'Parkinson Avançado');
    assert.equal(updatedB.allergies, 'Camarão, Amendoim, Dipirona');
  });

  await t.test('2. Deve cadastrar e listar receitas médicas com persistência no SQLite', () => {
    const result = prescriptionService.createPrescription(accA.account.id, profA.id, {
      specialty: 'Nutricionista',
      doctorName: 'Dra. Ana Martins',
      crm: 'CRM/SP 182.492',
      clinicOrHospital: 'Consultório Nutrição Integrada',
      emissionDate: '15/10/2026',
      expirationDate: '15/04/2027',
      medications: ['Vitamina C', 'Vitamina D'],
      instructions: 'Tomar pela manhã junto à refeição.',
      cardColor: '#B4ECFB',
    });

    assert.ok(!('error' in result));
    assert.ok(result.id.startsWith('rec_'));
    assert.equal(result.specialty, 'Nutricionista');
    assert.equal(result.doctorName, 'Dra. Ana Martins');
    assert.deepEqual(result.medications, ['Vitamina C', 'Vitamina D']);

    const list = prescriptionService.listPrescriptions(accA.account.id, profA.id);
    assert.ok(list);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, result.id);
  });

  await t.test('3. Deve atualizar e excluir logicamente uma receita médica', () => {
    const created = prescriptionService.createPrescription(accA.account.id, profA.id, {
      specialty: 'Cardiologista',
      doctorName: 'Dr. Pedro Almeida',
      emissionDate: '08/10/2026',
      medications: ['Losartana 50 mg'],
    }) as any;

    // Atualização
    const updated = prescriptionService.updatePrescription(accA.account.id, profA.id, created.id, {
      doctorName: 'Dr. Pedro A. Almeida',
      instructions: '1 comprimido pela manhã.',
    });
    assert.ok(updated);
    assert.equal(updated.doctorName, 'Dr. Pedro A. Almeida');
    assert.equal(updated.instructions, '1 comprimido pela manhã.');

    // Exclusão lógica
    const deleted = prescriptionService.deletePrescription(accA.account.id, profA.id, created.id);
    assert.equal(deleted, true);

    const afterDelete = prescriptionService.getPrescriptionById(accA.account.id, profA.id, created.id);
    assert.equal(afterDelete, null);
  });

  await t.test('4. Isolamento multi-tenant: Conta B não acessa nem modifica receitas da Conta A', () => {
    const recA = prescriptionService.createPrescription(accA.account.id, profA.id, {
      specialty: 'Endocrinologista',
      doctorName: 'Dra. Júlia Costa',
      emissionDate: '02/10/2026',
    }) as any;

    // Conta B tentando ler receita de A
    const attemptRead = prescriptionService.getPrescriptionById(accB.account.id, profA.id, recA.id);
    assert.equal(attemptRead, null);

    // Conta B tentando atualizar receita de A
    const attemptUpdate = prescriptionService.updatePrescription(accB.account.id, profA.id, recA.id, {
      specialty: 'Hacker',
    });
    assert.equal(attemptUpdate, null);

    // Conta B tentando deletar receita de A
    const attemptDelete = prescriptionService.deletePrescription(accB.account.id, profA.id, recA.id);
    assert.equal(attemptDelete, false);
  });

  await t.test('5. Rotas HTTP REST para receitas e perfil clínico', async () => {
    async function callHttp(method: string, url: string, body?: any, token?: string) {
      const { Readable } = await import('node:stream');
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

      handleProfileRoutes(req, res, profileService, medicationService, authService, occurrenceService, prescriptionService);
      return promise;
    }

    // 5.1. Criar receita via HTTP POST
    const postRes = await callHttp(
      'POST',
      `/api/v1/profiles/${profA.id}/prescriptions`,
      {
        specialty: 'Ginecologista',
        doctorName: 'Dra. Ana Martins',
        emissionDate: '25/09/2026',
        medications: ['Loratadina 10 mg'],
      },
      accA.accessToken
    );
    assert.equal(postRes.statusCode, 201);
    assert.ok(postRes.body.prescription.id);
    const createdId = postRes.body.prescription.id;

    // 5.2. Listar receitas via HTTP GET
    const getRes = await callHttp(
      'GET',
      `/api/v1/profiles/${profA.id}/prescriptions`,
      undefined,
      accA.accessToken
    );
    assert.equal(getRes.statusCode, 200);
    assert.ok(Array.isArray(getRes.body.prescriptions));
    assert.ok(getRes.body.prescriptions.some((p: any) => p.id === createdId));

    // 5.3. Atualizar perfil com dados clínicos via HTTP PATCH
    const patchRes = await callHttp(
      'PATCH',
      `/api/v1/profiles/${profA.id}`,
      {
        medicalConditions: 'Menopausa e Enxaqueca',
        allergies: 'Rinite alérgica',
      },
      accA.accessToken
    );
    assert.equal(patchRes.statusCode, 200);
    assert.equal(patchRes.body.profile.medicalConditions, 'Menopausa e Enxaqueca');
    assert.equal(patchRes.body.profile.allergies, 'Rinite alérgica');
  });
});
