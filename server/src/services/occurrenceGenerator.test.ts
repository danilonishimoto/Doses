import assert from 'node:assert';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { runVersionedMigrations } from '../db/migrator.js';
import {
  OccurrenceGeneratorService,
  getOrReconcileTemporalConfig,
  isMedicationScheduledForDate,
} from './occurrenceGeneratorService.js';
import { MedicationService } from './medicationService.js';
import { MedicationTimeService } from './medicationTimeService.js';
import { ProfileService } from './profileService.js';
import { softDeleteMedication, softDeleteProfile, softDeleteMedicationTime } from './domainService.js';

// Código do Worker Thread para testes de concorrência real
if (!isMainThread) {
  const { dbPath, action, horizonDays, targetTz } = workerData;
  const db = new Database(dbPath, { timeout: 10000 });
  db.pragma('busy_timeout = 10000');

  try {
    if (action === 'generate') {
      const generator = new OccurrenceGeneratorService(db);
      const res = generator.generateOccurrences(horizonDays || 3);
      parentPort?.postMessage({ success: true, res });
    } else if (action === 'reconcile') {
      const config = getOrReconcileTemporalConfig(db, targetTz);
      parentPort?.postMessage({ success: true, config });
    }
  } catch (err: any) {
    parentPort?.postMessage({ success: false, error: err.message });
  } finally {
    db.close();
  }
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);

async function runWorker(data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker parou com código ${code}`));
    });
  });
}

function createTestDb(): { db: Database.Database; dbPath: string } {
  const dbPath = `./data/test_generator_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
  const db = new Database(dbPath, { timeout: 10000 });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');
  runVersionedMigrations(db);
  return { db, dbPath };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  Suíte de Testes Automatizados — Etapa 3B (Motor de Ocorrências)');
  console.log('================================================================\n');

  let passed = 0;
  const { db, dbPath } = createTestDb();

  try {
    // -------------------------------------------------------------
    // SETUP: Criação de conta, perfis, medicamentos e horários base
    // -------------------------------------------------------------
    const accountId = 'acc_test_3b';
    db.prepare(`
      INSERT INTO accounts (id, username, password_hash, salt)
      VALUES (?, 'test3b_user', 'hash_test', 'salt_test')
    `).run(accountId);

    const profileService = new ProfileService(db);
    const medicationService = new MedicationService(db);
    const medicationTimeService = new MedicationTimeService(db);
    const generatorService = new OccurrenceGeneratorService(db);

    // Perfil Humano e Perfil Pet
    const humanProf = profileService.createProfile(accountId, { name: 'Danillo', avatar: 'avatar1' });
    const petProf = profileService.createProfile(accountId, { name: 'Rex (Pet)', avatar: 'avatar2' });
    const humanProfId = humanProf.id;
    const petProfId = petProf.id;

    // -------------------------------------------------------------
    // GRUPO 1: Geração Básica e Horizonte
    // -------------------------------------------------------------
    console.log('--- GRUPO 1: Geração Básica de Ocorrências e Horizonte ---');

    // 1.1 Medicamento com 1 horário
    const medA = medicationService.createMedication(accountId, humanProfId, {
      name: 'Losartana',
      dosage: '50mg',
      recurrence: 'DAILY',
    });
    const medAId = medA.medication!.id;
    const timeA1 = medicationTimeService.createMedicationTime(accountId, medAId, { time: '08:00' });
    const timeA1Id = timeA1.time!.id;

    const resGen1 = generatorService.generateOccurrences(3);
    assert.strictEqual(resGen1.generatedCount, 3);
    assert.strictEqual(resGen1.horizonDays, 3);
    assert.strictEqual(resGen1.timezone, 'America/Sao_Paulo');
    assert.strictEqual(resGen1.temporalVersion, 1);

    const rowsCount1 = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE medication_time_id = ?`).get(timeA1Id) as any;
    assert.strictEqual(rowsCount1.c, 3);

    // Todas devem ter status SCHEDULED
    const statusRows = db.prepare(`SELECT DISTINCT status FROM dose_occurrences`).all() as any[];
    assert.strictEqual(statusRows.length, 1);
    assert.strictEqual(statusRows[0].status, 'SCHEDULED');
    console.log('✓ Cenário 1: Medicamento com 1 horário gerou exatamente 3 ocorrências SCHEDULED para 3 dias');
    passed++;

    // 1.2 Medicamento com múltiplos horários (adiciona 20:00)
    const timeA2 = medicationTimeService.createMedicationTime(accountId, medAId, { time: '20:00' });
    const resGen2 = generatorService.generateOccurrences(3);
    // timeA1 já possui as 3; timeA2 recebe 3 novas
    assert.strictEqual(resGen2.generatedCount, 3);

    const totalRowsA = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE profile_id = ?`).get(humanProfId) as any;
    assert.strictEqual(totalRowsA.c, 6);
    console.log('✓ Cenário 2: Adição de segundo horário gerou 3 novas ocorrências sem duplicar as existentes');
    passed++;

    // 1.3 Múltiplos medicamentos e múltiplos perfis (humano e pet)
    const medPet = medicationService.createMedication(accountId, petProfId, {
      name: 'Vermífugo Pet',
      dosage: '1 comprimido',
      recurrence: 'DAILY',
    });
    const medPetId = medPet.medication!.id;
    medicationTimeService.createMedicationTime(accountId, medPetId, { time: '12:00' });

    const resGenPet = generatorService.generateOccurrences(3);
    assert.strictEqual(resGenPet.generatedCount, 3);

    const totalPetRows = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE profile_id = ?`).get(petProfId) as any;
    assert.strictEqual(totalPetRows.c, 3);
    console.log('✓ Cenário 3: Perfil pet e múltiplos perfis geram ocorrências isoladas corretamente');
    passed++;

    // 1.4 Respeito a entidades excluídas logicamente
    const medDeleted = medicationService.createMedication(accountId, humanProfId, {
      name: 'Medicamento Provisório',
      dosage: '10mg',
    });
    const medDelId = medDeleted.medication!.id;
    const timeDel = medicationTimeService.createMedicationTime(accountId, medDelId, { time: '15:00' });
    const timeDelId = timeDel.time!.id;

    // Exclui o medicamento
    medicationService.deleteMedication(accountId, medDelId);

    const resGenAfterDel = generatorService.generateOccurrences(3);
    assert.strictEqual(resGenAfterDel.generatedCount, 0);

    const countDelOccurrences = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE medication_time_id = ?`).get(timeDelId) as any;
    assert.strictEqual(countDelOccurrences.c, 0);
    console.log('✓ Cenário 4: Medicamento com is_deleted = 1 não gera nenhuma ocorrência');
    passed++;

    // -------------------------------------------------------------
    // GRUPO 2: Idempotência Estrita e Concorrência Real
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 2: Idempotência Estrita e Concorrência Real ---');

    // 2.1 Reexecução sequencial (idempotência perfeita)
    const resSeq = generatorService.generateOccurrences(3);
    assert.strictEqual(resSeq.generatedCount, 0);
    console.log('✓ Cenário 5: Reexecução sequencial gerou 0 duplicatas (idempotência verificada)');
    passed++;

    // 2.2 Reexecução com ampliação de horizonte (de 3 para 5 dias)
    const resHorizon5 = generatorService.generateOccurrences(5);
    // Temos 3 horários ativos: medA (08:00, 20:00) e medPet (12:00) = 3 horários * 2 dias novos (dias 3 e 4) = 6
    assert.strictEqual(resHorizon5.generatedCount, 6);
    console.log('✓ Cenário 6: Expansão do horizonte de 3 para 5 dias gerou estritamente os dias adicionais');
    passed++;

    // 2.3 Execução concorrente real com 2 Worker Threads simultâneos
    const [w1, w2] = await Promise.all([
      runWorker({ dbPath, action: 'generate', horizonDays: 5 }),
      runWorker({ dbPath, action: 'generate', horizonDays: 5 }),
    ]);

    if (!w1.success || !w2.success) {
      console.error('Worker 1 error:', w1, 'Worker 2 error:', w2);
    }

    assert.strictEqual(w1.success, true);
    assert.strictEqual(w2.success, true);
    // Como os 5 dias já estavam gerados, ambos os workers devem reportar 0 novas inserções
    assert.strictEqual(w1.res.generatedCount, 0);
    assert.strictEqual(w2.res.generatedCount, 0);
    console.log('✓ Cenário 7: Dois workers concorrentes reais executaram simultaneamente sem conflito');
    passed++;

    // -------------------------------------------------------------
    // GRUPO 3: Versionamento de Programação e Invalidação Atômica
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 3: Versionamento de Programação e Invalidação Atômica ---');

    // 3.1 Alteração de horário: updateMedicationTime cancela ocorrências antigas e bumps version
    const timeToChange = timeA2.time!;
    const resUpdateTime = medicationTimeService.updateMedicationTime(accountId, timeToChange.id, {
      time: '21:00',
    });
    assert.strictEqual(resUpdateTime.time!.version, 2);
    assert.strictEqual(resUpdateTime.time!.time, '21:00');
    assert.strictEqual(resUpdateTime.cancelledOccurrencesCount, 5); // 5 ocorrências agendadas de 20:00 canceladas

    // Verifica que as antigas de 20:00 agora são CANCELLED
    const cancelledCount = db.prepare(`
      SELECT count(*) as c FROM dose_occurrences
      WHERE medication_time_id = ? AND scheduled_time = '20:00' AND status = 'CANCELLED'
    `).get(timeToChange.id) as any;
    assert.strictEqual(cancelledCount.c, 5);

    // Gerador recria as novas ocorrências para o horário 21:00 com versão 2
    const resGenNewTime = generatorService.generateOccurrences(5);
    assert.strictEqual(resGenNewTime.generatedCount, 5);

    const newTimeCount = db.prepare(`
      SELECT count(*) as c FROM dose_occurrences
      WHERE medication_time_id = ? AND scheduled_time = '21:00' AND schedule_version = 2 AND status = 'SCHEDULED'
    `).get(timeToChange.id) as any;
    assert.strictEqual(newTimeCount.c, 5);
    console.log('✓ Cenário 8: Alteração de horário cancelou atomicamente ocorrências antigas e gerou versão 2');
    passed++;

    // 3.2 Alteração de recorrência: updateMedication cancela ocorrências e incrementa versões
    const resUpdateRec = medicationService.updateMedication(accountId, medAId, {
      recurrence: 'WEEKLY:1,3,5',
    });
    assert.strictEqual(resUpdateRec.medication!.version, 2);
    // Deve ter cancelado todas as ocorrências de todos os horários de medA
    assert.ok(resUpdateRec.cancelledOccurrencesCount! > 0);

    // Verifica que a versão dos horários associados também incrementou
    const updatedTimeRow = db.prepare(`SELECT version FROM medication_times WHERE id = ?`).get(timeA1Id) as any;
    assert.strictEqual(updatedTimeRow.version, 2);
    console.log('✓ Cenário 9: Alteração de recorrência incrementou versão em cascata e cancelou slots antigos');
    passed++;

    // 3.3 Alteração exclusiva de nome/dosagem: NÃO cancela ocorrências e NÃO incrementa horários
    const resGenBeforeName = generatorService.generateOccurrences(5);
    const countBeforeName = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE status = 'SCHEDULED'`).get() as any;

    const resUpdateName = medicationService.updateMedication(accountId, medAId, {
      name: 'Losartana Potássica Genérico',
      dosage: '100mg',
    });
    assert.strictEqual(resUpdateName.cancelledOccurrencesCount, 0);

    const countAfterName = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE status = 'SCHEDULED'`).get() as any;
    assert.strictEqual(countBeforeName.c, countAfterName.c);
    console.log('✓ Cenário 10: Alteração de nome/dosagem não cancelou ocorrências futuras');
    passed++;

    // 3.4 Controle otimista de versão (409 Conflict)
    const currentMed = medicationService.getMedicationById(accountId, medAId)!;
    const resConflict = medicationService.updateMedication(accountId, medAId, {
      name: 'Conflito',
      expectedVersion: currentMed.version - 1, // Versão defasada
    });
    assert.strictEqual(resConflict.error, 'VERSION_CONFLICT');
    console.log('✓ Cenário 11: Controle otimista bloqueou atualização concorrente com versão defasada');
    passed++;

    // 3.5 Proteção de ocorrências DISPATCHING com lease ativo
    // Simula uma ocorrência em DISPATCHING com lease no futuro (+60s)
    const sampleOcc = db.prepare(`SELECT id FROM dose_occurrences WHERE status = 'SCHEDULED' LIMIT 1`).get() as any;
    const activeLeaseUntil = Date.now() + 60000;
    db.prepare(`
      UPDATE dose_occurrences
      SET status = 'DISPATCHING',
          lease_token = 'token_worker_test',
          lease_until = ?
      WHERE id = ?
    `).run(activeLeaseUntil, sampleOcc.id);

    // Agora exclui o horário deste registro
    const occRow = db.prepare(`SELECT medication_time_id FROM dose_occurrences WHERE id = ?`).get(sampleOcc.id) as any;
    medicationTimeService.deleteMedicationTime(accountId, occRow.medication_time_id);

    // A ocorrência com lease ativo NÃO deve ter sido cancelada
    const occAfterDel = db.prepare(`SELECT status, lease_token FROM dose_occurrences WHERE id = ?`).get(sampleOcc.id) as any;
    assert.strictEqual(occAfterDel.status, 'DISPATCHING');
    assert.strictEqual(occAfterDel.lease_token, 'token_worker_test');
    console.log('✓ Cenário 12: Ocorrência em DISPATCHING com lease ativo foi resguardada contra cancelamento');
    passed++;

    // 3.6 Rejeição estrita de recorrência inválida em createMedication e updateMedication
    const resBadCreate = medicationService.createMedication(accountId, humanProfId, {
      name: 'Medicamento Recorrência Ruim',
      recurrence: 'semanal', // Inválido
    });
    assert.strictEqual(resBadCreate.error, 'INVALID_RECURRENCE');

    const medBeforeBadUpdate = medicationService.getMedicationById(accountId, medAId)!;
    const countBeforeBadUpdate = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE status = 'SCHEDULED'`).get() as any;

    const resBadUpdate = medicationService.updateMedication(accountId, medAId, {
      recurrence: 'WEEKLY:1,8', // Dia 8 inválido
    });
    assert.strictEqual(resBadUpdate.error, 'INVALID_RECURRENCE');

    // Confirma que versões e ocorrências permanecem 100% inalteradas
    const medAfterBadUpdate = medicationService.getMedicationById(accountId, medAId)!;
    assert.strictEqual(medBeforeBadUpdate.version, medAfterBadUpdate.version);
    const countAfterBadUpdate = db.prepare(`SELECT count(*) as c FROM dose_occurrences WHERE status = 'SCHEDULED'`).get() as any;
    assert.strictEqual(countBeforeBadUpdate.c, countAfterBadUpdate.c);

    // Confirma que isMedicationScheduledForDate lança erro para recorrência inválida e NUNCA faz fallback para diário
    assert.throws(() => {
      isMedicationScheduledForDate('semanal', '2026-11-05', 'America/Sao_Paulo');
    }, /Recorrência inválida/);
    console.log('✓ Cenário 13: Validação estrita de recorrência rejeitou valores inválidos sem alterar versão nem dados');
    passed++;

    // -------------------------------------------------------------
    // GRUPO 4: Reconciliação Temporal e Mudança de Timezone
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 4: Reconciliação Temporal e Mudança de Timezone ---');

    // 4.1 Configuração inicial
    const initialConfig = getOrReconcileTemporalConfig(db, 'America/Sao_Paulo');
    assert.strictEqual(initialConfig.timezone, 'America/Sao_Paulo');
    assert.strictEqual(initialConfig.temporalVersion, 1);
    console.log('✓ Cenário 14: Configuração temporal inicial confirmada em America/Sao_Paulo v1');
    passed++;

    // 4.2 Mudança de timezone para America/New_York (Reconciliação)
    const reconciledConfig = getOrReconcileTemporalConfig(db, 'America/New_York');
    assert.strictEqual(reconciledConfig.timezone, 'America/New_York');
    assert.strictEqual(reconciledConfig.temporalVersion, 2);

    // Ocorrências futuras SCHEDULED anteriores devem ter sido canceladas
    const oldScheduledCount = db.prepare(`
      SELECT count(*) as c FROM dose_occurrences
      WHERE temporal_version = 1 AND status = 'SCHEDULED'
    `).get() as any;
    assert.strictEqual(oldScheduledCount.c, 0);
    console.log('✓ Cenário 15: Reconciliação para America/New_York cancelou ocorrências de v1 e avançou para v2');
    passed++;

    // 4.3 Geração sob nova configuração temporal (sem colisão com o índice único)
    // O índice único inclui temporal_version, logo o novo slot (com temporal_version = 2) não colide
    const nyGeneratorService = new OccurrenceGeneratorService(db, 'America/New_York');
    const resGenTz2 = nyGeneratorService.generateOccurrences(3);
    assert.strictEqual(resGenTz2.temporalVersion, 2);
    assert.strictEqual(resGenTz2.timezone, 'America/New_York');
    assert.ok(resGenTz2.generatedCount > 0);

    const v2Rows = db.prepare(`
      SELECT count(*) as c FROM dose_occurrences
      WHERE temporal_version = 2 AND status = 'SCHEDULED'
    `).get() as any;
    assert.strictEqual(v2Rows.c, resGenTz2.generatedCount);
    console.log('✓ Cenário 16: Ocorrências geradas sob v2 sem colisão com histórico cancelado de v1');
    passed++;

    // 4.4 Concorrência real de reconciliação com 2 Worker Threads
    const [recW1, recW2] = await Promise.all([
      runWorker({ dbPath, action: 'reconcile', targetTz: 'Europe/London' }),
      runWorker({ dbPath, action: 'reconcile', targetTz: 'Europe/London' }),
    ]);

    assert.strictEqual(recW1.success, true);
    assert.strictEqual(recW2.success, true);
    // Ambos devem ver Europe/London na mesma versão (v3)
    assert.strictEqual(recW1.config.timezone, 'Europe/London');
    assert.strictEqual(recW2.config.timezone, 'Europe/London');
    assert.strictEqual(recW1.config.temporalVersion, 3);
    assert.strictEqual(recW2.config.temporalVersion, 3);
    console.log('✓ Cenário 17: Concorrência real entre workers durante reconciliação convergiu para versão única');
    passed++;

    // -------------------------------------------------------------
    // GRUPO 5: Integridade Composta Direta e Foreign Keys
    // -------------------------------------------------------------
    console.log('\n--- GRUPO 5: Integridade Composta e Ausência de Duplicações ---');

    // 5.1 Tentativa de inserção duplicada do mesmo slot rejeitada pela restrição física
    const sampleSlot = db.prepare(`
      SELECT medication_time_id, scheduled_date, scheduled_time, schedule_version, temporal_version
      FROM dose_occurrences LIMIT 1
    `).get() as any;

    let duplicateRejected = false;
    try {
      db.prepare(`
        INSERT INTO dose_occurrences (
          id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time,
          timezone, scheduled_at_utc, schedule_version, temporal_version, status
        ) VALUES (
          'id_manual_dup', ?, 'dummy_prof', 'dummy_acc', ?, ?,
          'UTC', 123456789, ?, ?, 'SCHEDULED'
        )
      `).run(
        sampleSlot.medication_time_id,
        sampleSlot.scheduled_date,
        sampleSlot.scheduled_time,
        sampleSlot.schedule_version,
        sampleSlot.temporal_version
      );
    } catch {
      duplicateRejected = true;
    }
    assert.strictEqual(duplicateRejected, true);
    console.log('✓ Cenário 18: Índice único físico idx_occurrences_slot rejeitou duplicação manual de slot');
    passed++;

    // 5.2 Validação de integridade referencial com PRAGMA foreign_key_check
    const fkErrors = db.prepare(`PRAGMA foreign_key_check`).all();
    assert.strictEqual(fkErrors.length, 0);
    console.log('✓ Cenário 19: PRAGMA foreign_key_check confirmou zero violações no banco de dados');
    passed++;

    console.log('\n================================================================');
    console.log(`  RESULTADO: ${passed} de 19 testes da Etapa 3B APROVADOS!       `);
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

runTestSuite().catch((err) => {
  console.error('\n[FALHA NO TESTE DA ETAPA 3B]:', err);
  process.exit(1);
});
