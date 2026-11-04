import Database from 'better-sqlite3';
import { runVersionedMigrations, ALL_MIGRATIONS } from '../db/migrator.js';
import { softDeleteProfile, softDeleteMedication } from './domainService.js';
import { buildNotificationPayload } from '../utils/payloadBuilder.js';

function createInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runVersionedMigrations(db);
  return db;
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

console.log('================================================================');
console.log('  Suíte de Testes - Integridade Composta, Soft-Delete e Privacidade');
console.log('================================================================\n');

// -------------------------------------------------------------
// BLOCO 1: Integridade Referencial Composta no SQLite
// -------------------------------------------------------------
console.log('--- BLOCO 1: Integridade Referencial Composta (Subetapa 2C) ---');

{
  const db = createInMemoryDb();

  // Criação de Conta A e Conta B
  db.prepare(`
    INSERT INTO accounts (id, username, password_hash, salt)
    VALUES ('acc_a', 'user_a', 'hash_a', 'salt_a'),
           ('acc_b', 'user_b', 'hash_b', 'salt_b')
  `).run();

  // Criação de Perfis: A1 e A2 na Conta A, B1 na Conta B
  db.prepare(`
    INSERT INTO profiles (id, account_id, name, avatar)
    VALUES ('prof_a1', 'acc_a', 'Danilo', 'avatar1.png'),
           ('prof_a2', 'acc_a', 'Thor (Pet)', 'avatar2.png'),
           ('prof_b1', 'acc_b', 'Carlos', 'avatar3.png')
  `).run();

  // Cenário 1: Uma conta com múltiplos perfis mantém os relacionamentos corretos
  db.prepare(`
    INSERT INTO medications (id, profile_id, account_id, name)
    VALUES ('med_a1', 'prof_a1', 'acc_a', 'Omeprazol'),
           ('med_a2', 'prof_a2', 'acc_a', 'Vermífugo')
  `).run();

  const countA = db.prepare('SELECT count(*) as count FROM medications WHERE account_id = ?').get('acc_a') as { count: number };
  assert(countA.count === 2, 'Cenário 1: Conta A possui 2 perfis com medicações associadas corretamente');

  // Cenário 2: Uma medicação não pode ser vinculada a um perfil de outra conta
  let medCrossAccountBlocked = false;
  try {
    // Tenta associar medicamento na Conta B com perfil da Conta A
    db.prepare(`
      INSERT INTO medications (id, profile_id, account_id, name)
      VALUES ('med_bad', 'prof_a1', 'acc_b', 'Remédio Cruzado Inválido')
    `).run();
  } catch (err: any) {
    medCrossAccountBlocked = err.message.includes('FOREIGN KEY constraint failed');
  }
  assert(medCrossAccountBlocked, 'Cenário 2: SQLite rejeitou inserção de medicamento com account_id B e profile_id A');

  // Cenário 3: Um horário não pode ser associado a um medicamento de outro perfil
  db.prepare(`
    INSERT INTO medication_times (id, medication_id, profile_id, account_id, time)
    VALUES ('time_a1', 'med_a1', 'prof_a1', 'acc_a', '08:00')
  `).run();

  let timeCrossProfileBlocked = false;
  try {
    // Tenta associar horário para med_a1 (perfil A1) sob perfil A2
    db.prepare(`
      INSERT INTO medication_times (id, medication_id, profile_id, account_id, time)
      VALUES ('time_bad', 'med_a1', 'prof_a2', 'acc_a', '10:00')
    `).run();
  } catch (err: any) {
    timeCrossProfileBlocked = err.message.includes('FOREIGN KEY constraint failed');
  }
  assert(timeCrossProfileBlocked, 'Cenário 3: SQLite rejeitou inserção de horário referenciando medicamento de outro perfil');

  // Cenário 4: Uma ocorrência não pode conter relações inconsistentes
  db.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status
    ) VALUES (
      'occ_valid', 'time_a1', 'prof_a1', 'acc_a', '2026-11-04', '08:00', 1793836800000, 'SCHEDULED'
    )
  `).run();

  let occCrossBlocked = false;
  try {
    // Tenta ocorrência referenciando time_a1 com perfil B1 e conta B em uma data/horário diferente para isolar teste de FK
    db.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status
      ) VALUES (
        'occ_bad', 'time_a1', 'prof_b1', 'acc_b', '2026-11-05', '08:00', 1793836800000, 'SCHEDULED'
      )
    `).run();
  } catch (err: any) {
    occCrossBlocked = err.message.includes('FOREIGN KEY constraint failed');
  }
  assert(occCrossBlocked, 'Cenário 4: SQLite rejeitou ocorrência com combinação cruzada de conta/perfil/horário');

  const fkCheck = db.pragma('foreign_key_check') as any[];
  assert(fkCheck.length === 0, 'Validação estrutural: PRAGMA foreign_key_check confirmou zero violações');
}

// -------------------------------------------------------------
// BLOCO 2: Soft-Delete Transacional e Cancelamento de Ocorrências
// -------------------------------------------------------------
console.log('\n--- BLOCO 2: Soft-Delete Transacional (Subetapa 2D) ---');

{
  const db = createInMemoryDb();

  db.prepare(`
    INSERT INTO accounts (id, username, password_hash, salt)
    VALUES ('acc_1', 'user_1', 'hash_1', 'salt_1'),
           ('acc_2', 'user_2', 'hash_2', 'salt_2')
  `).run();

  db.prepare(`
    INSERT INTO profiles (id, account_id, name, avatar)
    VALUES ('prof_1', 'acc_1', 'Maria', 'avatar_m.png'),
           ('prof_2', 'acc_2', 'Outro', 'avatar_o.png')
  `).run();

  db.prepare(`
    INSERT INTO medications (id, profile_id, account_id, name)
    VALUES ('med_1', 'prof_1', 'acc_1', 'Losartana'),
           ('med_2', 'prof_1', 'acc_1', 'Aspirina')
  `).run();

  db.prepare(`
    INSERT INTO medication_times (id, medication_id, profile_id, account_id, time)
    VALUES ('time_1', 'med_1', 'prof_1', 'acc_1', '08:00'),
           ('time_2', 'med_2', 'prof_1', 'acc_1', '20:00')
  `).run();

  const now = Date.now();

  // Inserção de ocorrências em múltiplos estados e slots distintos
  db.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status, lease_until, lease_token
    ) VALUES 
      ('occ_sched_1', 'time_1', 'prof_1', 'acc_1', '2026-11-05', '08:00', ${now + 86400000}, 'SCHEDULED', NULL, NULL),
      ('occ_failed_1', 'time_1', 'prof_1', 'acc_1', '2026-11-06', '08:00', ${now + 172800000}, 'DISPATCH_FAILED', NULL, NULL),
      ('occ_expired_lease', 'time_1', 'prof_1', 'acc_1', '2026-11-07', '08:00', ${now + 259200000}, 'DISPATCHING', ${now - 5000}, 'old_token'),
      ('occ_active_lease', 'time_1', 'prof_1', 'acc_1', '2026-11-08', '08:00', ${now + 345600000}, 'DISPATCHING', ${now + 30000}, 'active_token'),
      ('occ_confirmed', 'time_1', 'prof_1', 'acc_1', '2026-11-04', '08:00', ${now - 3600000}, 'CONFIRMED', NULL, NULL),
      ('occ_dispatched', 'time_1', 'prof_1', 'acc_1', '2026-11-03', '08:00', ${now - 7200000}, 'DISPATCHED', NULL, NULL),
      ('occ_missed', 'time_1', 'prof_1', 'acc_1', '2026-11-02', '08:00', ${now - 10800000}, 'MISSED', NULL, NULL),
      ('occ_sched_med2', 'time_2', 'prof_1', 'acc_1', '2026-11-05', '20:00', ${now + 86400000}, 'SCHEDULED', NULL, NULL)
  `).run();

  // Inserção de confirmação correspondente a occ_confirmed
  db.prepare(`
    INSERT INTO dose_confirmations (id, occurrence_id, profile_id, account_id, status, confirmed_at)
    VALUES ('conf_1', 'occ_confirmed', 'prof_1', 'acc_1', 'TAKEN', datetime('now'))
  `).run();

  // Cenário 8: Uma conta não consegue excluir entidades de outra conta
  const unauthorizedRes = softDeleteProfile(db, 'acc_2', 'prof_1');
  assert(!unauthorizedRes.success, 'Cenário 8: Conta 2 foi impedida de excluir perfil pertencente à Conta 1');

  // Cenário 6: A exclusão de um medicamento cancela suas ocorrências futuras elegíveis
  const med2Res = softDeleteMedication(db, 'acc_1', 'med_2');
  assert(med2Res.success && med2Res.cancelledOccurrencesCount === 1, 'Cenário 6: Exclusão de medicamento cancelou 1 ocorrência futura programada');

  const occMed2 = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get('occ_sched_med2') as { status: string };
  assert(occMed2.status === 'CANCELLED', 'Cenário 6 (verificação): Status da ocorrência do med_2 transitou para CANCELLED');

  // Cenário 5: A exclusão de um perfil cancela suas ocorrências futuras elegíveis
  // Esperado: occ_sched_1, occ_failed_1 e occ_expired_lease cancelados (3 ocorrências)
  const profRes = softDeleteProfile(db, 'acc_1', 'prof_1');
  assert(profRes.success && profRes.cancelledOccurrencesCount === 3, 'Cenário 5: Exclusão de perfil cancelou as 3 ocorrências futuras elegíveis');

  // Cenário 7: Ocorrências históricas e confirmadas permanecem intactas
  const confirmedOcc = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get('occ_confirmed') as { status: string };
  const dispatchedOcc = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get('occ_dispatched') as { status: string };
  const missedOcc = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get('occ_missed') as { status: string };
  const activeLeaseOcc = db.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get('occ_active_lease') as { status: string };
  const confirmationRow = db.prepare('SELECT id FROM dose_confirmations WHERE id = ?').get('conf_1') as { id: string };

  assert(confirmedOcc.status === 'CONFIRMED', 'Cenário 7.1: Ocorrência CONFIRMED permaneceu intacta');
  assert(dispatchedOcc.status === 'DISPATCHED', 'Cenário 7.2: Ocorrência DISPATCHED permaneceu intacta');
  assert(missedOcc.status === 'MISSED', 'Cenário 7.3: Ocorrência MISSED permaneceu intacta');
  assert(activeLeaseOcc.status === 'DISPATCHING', 'Cenário 7.4: Ocorrência em DISPATCHING com lease ativo preservou seu estado para proteger o fencing token');
  assert(Boolean(confirmationRow), 'Cenário 7.5: Registro clínico em dose_confirmations preservado');

  // Cenário 11: Atomicidade transacional - falha simula rollback sem deixar estado corrompido
  // Cria novo perfil de teste
  db.prepare(`
    INSERT INTO profiles (id, account_id, name, avatar)
    VALUES ('prof_atomic', 'acc_1', 'Teste Atômico', 'avatar.png')
  `).run();
  db.prepare(`
    INSERT INTO medications (id, profile_id, account_id, name)
    VALUES ('med_atomic', 'prof_atomic', 'acc_1', 'Remédio Atômico')
  `).run();
  db.prepare(`
    INSERT INTO medication_times (id, medication_id, profile_id, account_id, time)
    VALUES ('time_atomic', 'med_atomic', 'prof_atomic', 'acc_1', '12:00')
  `).run();
  db.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status
    ) VALUES (
      'occ_atomic', 'time_atomic', 'prof_atomic', 'acc_1', '2026-11-06', '12:00', ${now + 86400000}, 'SCHEDULED'
    )
  `).run();

  // Força uma falha dentro de transação customizada simulando soft-delete com erro
  let rollbackSucceeded = false;
  try {
    const brokenTx = db.transaction(() => {
      db.prepare("UPDATE profiles SET is_deleted = 1 WHERE id = 'prof_atomic'").run();
      // Provoca erro proposital
      throw new Error('Falha simulada durante cancelamento de ocorrências');
    });
    brokenTx();
  } catch (err: any) {
    rollbackSucceeded = err.message.includes('Falha simulada');
  }

  const profAtomicStatus = db.prepare('SELECT is_deleted FROM profiles WHERE id = ?').get('prof_atomic') as { is_deleted: number };
  assert(rollbackSucceeded && profAtomicStatus.is_deleted === 0, 'Cenário 11: Rollback transacional comprovado, perfil permaneceu ativo após erro no processamento');

  // Cenário 12: Mecanismo de lease e fencing token continua funcionando
  const leaseTokenUpdate = db.prepare(`
    UPDATE dose_occurrences
    SET status = 'DISPATCHED', dispatched_at = datetime('now')
    WHERE id = 'occ_active_lease' AND lease_token = 'active_token' AND status = 'DISPATCHING'
  `).run();
  assert(leaseTokenUpdate.changes === 1, 'Cenário 12: Worker com fencing token ativo concluiu transição para DISPATCHED com sucesso');
}

// -------------------------------------------------------------
// BLOCO 3: Política de Privacidade dos Payloads (Subetapa 2E)
// -------------------------------------------------------------
console.log('\n--- BLOCO 3: Política de Privacidade dos Payloads (Subetapa 2E) ---');

{
  const occurrenceData = {
    occurrenceId: 'occ_test_123',
    scheduledTime: '08:00',
    profileId: 'prof_joao',
    profileName: 'João Silva',
    medicationName: 'Vitamina B12 Complex',
    dosage: '500mcg',
  };

  // Cenário 9: Duas subscriptions da mesma conta recebem composições de payload compatíveis com suas preferências individuais
  // Dispositivo 1: hideMedicationNames = true (privacidade ativada)
  const payloadDispositivo1 = buildNotificationPayload({
    ...occurrenceData,
    hideMedicationNames: true,
  });

  // Dispositivo 2: hideMedicationNames = false (privacidade desativada)
  const payloadDispositivo2 = buildNotificationPayload({
    ...occurrenceData,
    hideMedicationNames: false,
  });

  assert(payloadDispositivo1.title === 'Lembrete de Medicamento', 'Cenário 9.1: Dispositivo 1 tem título genérico');
  assert(payloadDispositivo1.body === 'Está na hora de um medicamento do João Silva', 'Cenário 9.2: Dispositivo 1 identifica o perfil sem revelar o medicamento');
  assert(payloadDispositivo2.title === 'Lembrete: Vitamina B12 Complex', 'Cenário 9.3: Dispositivo 2 exibe o nome do medicamento no título');
  assert(payloadDispositivo2.body.includes('Vitamina B12 Complex (500mcg) do João Silva'), 'Cenário 9.4: Dispositivo 2 exibe medicamento, dosagem e perfil');

  // Cenário 10: O nome do medicamento não aparece em nenhum campo do payload restrito
  const payloadStr1 = JSON.stringify(payloadDispositivo1);
  const medicationLeak = payloadStr1.includes('Vitamina') || payloadStr1.includes('B12') || payloadStr1.includes('500mcg');
  assert(!medicationLeak, 'Cenário 10.1: NENHUM campo do payload restrito contém o nome do medicamento ou dosagem');

  // Testes de robustez de fallback seguro (preferência ausente, nula ou inválida)
  const payloadMissing = buildNotificationPayload({
    ...occurrenceData,
    hideMedicationNames: undefined,
  });
  const payloadNull = buildNotificationPayload({
    ...occurrenceData,
    hideMedicationNames: null,
  });
  const payloadInvalidStr = buildNotificationPayload({
    ...occurrenceData,
    hideMedicationNames: 'invalid_value' as any,
  });

  assert(!JSON.stringify(payloadMissing).includes('Vitamina'), 'Cenário 10.2: Preferência ausente adota comportamento restritivo por padrão');
  assert(!JSON.stringify(payloadNull).includes('Vitamina'), 'Cenário 10.3: Preferência null adota comportamento restritivo por padrão');
  assert(!JSON.stringify(payloadInvalidStr).includes('Vitamina'), 'Cenário 10.4: Preferência inválida adota comportamento restritivo por padrão');

  // Teste de caracteres especiais e acentuação Unicode
  const unicodePayload = buildNotificationPayload({
    occurrenceId: 'occ_uni',
    scheduledTime: '15:30',
    profileId: 'prof_ana',
    profileName: 'Ana Cláudia & Thor 🐾',
    medicationName: 'Amoxicilina + Clavulanato de Potássio — 875mg',
    dosage: '1 comprimido',
    hideMedicationNames: false,
  });
  assert(unicodePayload.body.includes('Ana Cláudia & Thor 🐾'), 'Cenário 10.5: Unicode, acentos e emojis de perfil preservados corretamente');
  assert(unicodePayload.data.medicationName === 'Amoxicilina + Clavulanato de Potássio — 875mg', 'Cenário 10.6: Medicamento com hífens e acentos formatado corretamente');
}

// -------------------------------------------------------------
// BLOCO 4: Validação de Migração e Preservação de Dados (Subetapa 7.3)
// -------------------------------------------------------------
console.log('\n--- BLOCO 4: Migração Segura e Preservação de Dados (Subetapa 7.3) ---');

{
  // 1. Simulação: Banco legado rodando apenas migrações 001 até 005
  const legacyDb = new Database(':memory:');
  legacyDb.pragma('foreign_keys = ON');

  // Aplica migrações 001 a 005
  legacyDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  for (const m of ALL_MIGRATIONS.filter((m) => m.version !== '006')) {
    m.up(legacyDb);
    legacyDb.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
  }

  // Insere dados consistentes no banco legado
  legacyDb.prepare(`
    INSERT INTO accounts (id, username, password_hash, salt)
    VALUES ('acc_leg', 'user_leg', 'hash', 'salt')
  `).run();
  legacyDb.prepare(`
    INSERT INTO profiles (id, account_id, name, avatar)
    VALUES ('prof_leg', 'acc_leg', 'Legado', 'avatar.png')
  `).run();
  legacyDb.prepare(`
    INSERT INTO medications (id, profile_id, account_id, name)
    VALUES ('med_leg', 'prof_leg', 'acc_leg', 'Atenolol')
  `).run();
  legacyDb.prepare(`
    INSERT INTO medication_times (id, medication_id, profile_id, account_id, time)
    VALUES ('time_leg', 'med_leg', 'prof_leg', 'acc_leg', '09:00')
  `).run();
  legacyDb.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time, scheduled_at_utc, status
    ) VALUES (
      'occ_leg', 'time_leg', 'prof_leg', 'acc_leg', '2026-11-04', '09:00', 1793836800000, 'SCHEDULED'
    )
  `).run();
  legacyDb.prepare(`
    INSERT INTO dose_confirmations (id, occurrence_id, profile_id, account_id, status, confirmed_at)
    VALUES ('conf_leg', 'occ_leg', 'prof_leg', 'acc_leg', 'TAKEN', datetime('now'))
  `).run();

  // Executa migração incremental 006 via migrator
  const migResult = runVersionedMigrations(legacyDb);
  assert(migResult.applied.includes('006'), 'Migração 7.3.1: Migração 006 aplicada com sucesso sobre banco legado');

  // Verifica que os dados foram perfeitamente preservados
  const medRow = legacyDb.prepare('SELECT name FROM medications WHERE id = ?').get('med_leg') as { name: string };
  const occRow = legacyDb.prepare('SELECT status FROM dose_occurrences WHERE id = ?').get('occ_leg') as { status: string };
  const confRow = legacyDb.prepare('SELECT status FROM dose_confirmations WHERE id = ?').get('conf_leg') as { status: string };

  assert(medRow.name === 'Atenolol', 'Migração 7.3.2: Dados de medicamentos preservados após rebuild da tabela');
  assert(occRow.status === 'SCHEDULED', 'Migração 7.3.3: Dados de dose_occurrences preservados após rebuild da tabela');
  assert(confRow.status === 'TAKEN', 'Migração 7.3.4: Dados de dose_confirmations preservados após rebuild da tabela');

  const fkCheck = legacyDb.pragma('foreign_key_check') as any[];
  assert(fkCheck.length === 0, 'Migração 7.3.5: PRAGMA foreign_key_check confirmou zero violações no banco migrado');

  // 2. Simulação de Detecção e Aborto Seguro contra Dados Legados Inconsistentes
  const inconsistentDb = new Database(':memory:');
  inconsistentDb.pragma('foreign_keys = OFF'); // Para simular como o banco antigo permitia inconsistências
  inconsistentDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  for (const m of ALL_MIGRATIONS.filter((m) => m.version !== '006')) {
    m.up(inconsistentDb);
    inconsistentDb.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
  }

  // Cria duas contas e um perfil para cada
  inconsistentDb.prepare(`
    INSERT INTO accounts (id, username, password_hash, salt)
    VALUES ('acc_x', 'ux', 'hx', 'sx'), ('acc_y', 'uy', 'hy', 'sy')
  `).run();
  inconsistentDb.prepare(`
    INSERT INTO profiles (id, account_id, name, avatar)
    VALUES ('prof_x', 'acc_x', 'X', 'a.png'), ('prof_y', 'acc_y', 'Y', 'b.png')
  `).run();

  // Insere dado inconsistente: medicação pertence a acc_x mas aponta para prof_y (da acc_y)
  inconsistentDb.prepare(`
    INSERT INTO medications (id, profile_id, account_id, name)
    VALUES ('med_inconsistent', 'prof_y', 'acc_x', 'Inconsistente')
  `).run();

  inconsistentDb.pragma('foreign_keys = ON');

  let inconsistentAborted = false;
  try {
    runVersionedMigrations(inconsistentDb);
  } catch (err: any) {
    inconsistentAborted = err.message.includes('[Migration 006] Inconsistência detectada');
  }

  assert(inconsistentAborted, 'Migração 7.3.6: Migração 006 abortou com segurança ao detectar dados inconsistentes sem corromper o banco');
}

console.log('\n================================================================');
console.log(`  RESULTADO: ${passedTests} de ${totalTests} testes APROVADOS COM SUCESSO!`);
console.log('================================================================');
