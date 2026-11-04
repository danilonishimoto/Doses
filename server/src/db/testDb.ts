import { getDatabase, closeDatabase } from './connection.js';
import { runMigrations } from './migrate.js';
import { generateLocalVapidKeys } from '../config/vapid.js';
import crypto from 'node:crypto';

console.log('--- Iniciando Teste de Validação da Etapa 1 (DB e VAPID) ---');

// 1. Testa banco em memória para isolamento do teste
const testDb = getDatabase(':memory:');
runMigrations(testDb);

console.log('1. Migrações aplicadas com sucesso no banco de teste.');

// 2. Testa inserção de conta e integridade
const accountId = 'acc_test_' + crypto.randomUUID();
testDb.prepare(`
  INSERT INTO accounts (id, username, password_hash, salt)
  VALUES (?, ?, ?, ?)
`).run(accountId, 'paciente_teste', 'fake_hash', 'fake_salt');

console.log('2. Conta de teste criada.');

// 3. Testa inserção de perfil com versionamento
const profileId = 'prof_test_' + crypto.randomUUID();
testDb.prepare(`
  INSERT INTO profiles (id, account_id, name, avatar, is_main_profile, version)
  VALUES (?, ?, ?, ?, 1, 1)
`).run(profileId, accountId, 'Seu José', 'senior-person');

console.log('3. Perfil de teste associado com sucesso.');

// 4. Testa inserção de medicamento e horário
const medId = 'med_test_' + crypto.randomUUID();
testDb.prepare(`
  INSERT INTO medications (id, profile_id, account_id, name, dosage, recurrence, version)
  VALUES (?, ?, ?, ?, ?, 'DAILY', 1)
`).run(medId, profileId, accountId, 'Losartana', '50mg');

const timeId = 'time_test_' + crypto.randomUUID();
testDb.prepare(`
  INSERT INTO medication_times (id, medication_id, profile_id, account_id, time, version)
  VALUES (?, ?, ?, ?, '08:00', 1)
`).run(timeId, medId, profileId, accountId);

console.log('4. Medicamento e horário programado inseridos.');

// 5. Testa inserção de ocorrência com hash determinístico
const dateStr = '2026-11-04';
const timeStr = '08:00';
const version = 1;
const occurrenceId = crypto.createHash('sha256').update(`${timeId}_${dateStr}_${timeStr}_${version}`).digest('hex');

testDb.prepare(`
  INSERT INTO dose_occurrences (
    id, medication_time_id, profile_id, account_id,
    scheduled_date, scheduled_time, timezone, scheduled_at_utc,
    schedule_version, status, retry_count
  ) VALUES (?, ?, ?, ?, ?, ?, 'America/Sao_Paulo', ?, ?, 'SCHEDULED', 0)
`).run(occurrenceId, timeId, profileId, accountId, dateStr, timeStr, Date.now(), version);

console.log('5. Ocorrência programada criada com ID determinístico:', occurrenceId.slice(0, 16) + '...');

// 6. Testa violação de unicidade (Garantia de Idempotência no Banco)
let uniquenessBlocked = false;
try {
  testDb.prepare(`
    INSERT INTO dose_occurrences (
      id, medication_time_id, profile_id, account_id,
      scheduled_date, scheduled_time, timezone, scheduled_at_utc,
      schedule_version, status, retry_count
    ) VALUES (?, ?, ?, ?, ?, ?, 'America/Sao_Paulo', ?, ?, 'SCHEDULED', 0)
  `).run('different_id_same_slot', timeId, profileId, accountId, dateStr, timeStr, Date.now(), version);
} catch (err: any) {
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    uniquenessBlocked = true;
  }
}

if (!uniquenessBlocked) {
  throw new Error('Falha no teste: o banco permitiu duplicar a mesma ocorrência no mesmo horário/dia/versão!');
}
console.log('6. Idempotência no banco validada com sucesso: duplicata bloqueada pela constraint física.');

// 7. Testa mecanismo de reserva atômica (Lease) do agendador
const leaseUntil = Date.now() + 60000;
const updateResult = testDb.prepare(`
  UPDATE dose_occurrences
  SET status = 'DISPATCHING', lease_until = ?, updated_at = datetime('now')
  WHERE id = ? AND status = 'SCHEDULED'
`).run(leaseUntil, occurrenceId);

if (updateResult.changes !== 1) {
  throw new Error('Falha no teste de lock com lease!');
}

// Tentativa de outro worker pegar o mesmo lease deve alterar 0 linhas
const concurrentResult = testDb.prepare(`
  UPDATE dose_occurrences
  SET status = 'DISPATCHING', lease_until = ?, updated_at = datetime('now')
  WHERE id = ? AND status = 'SCHEDULED'
`).run(leaseUntil + 5000, occurrenceId);

if (concurrentResult.changes !== 0) {
  throw new Error('Falha no teste: lock concorrente permitiu duplo processamento!');
}
console.log('7. Lock atômico com lease testado com sucesso (zero concorrência).');

// 8. Testa geração de chaves VAPID locais
const vapid = generateLocalVapidKeys();
if (!vapid.publicKey || !vapid.privateKey) {
  throw new Error('Falha na geração de chaves VAPID locais!');
}
console.log('8. Geração de chaves VAPID locais validada (Chave Pública:', vapid.publicKey.slice(0, 20) + '...).');

// 9. Testa preferência padrão de privacidade
const subId = 'sub_test_' + crypto.randomUUID();
testDb.prepare(`
  INSERT INTO push_subscriptions (id, account_id, endpoint, p256dh, auth)
  VALUES (?, ?, 'https://push.example.com/endpoint', 'p256', 'auth')
`).run(subId, accountId);

const sub = testDb.prepare('SELECT hide_medication_names FROM push_subscriptions WHERE id = ?').get(subId) as { hide_medication_names: number };
if (sub.hide_medication_names !== 1) {
  throw new Error('Falha: o padrão de privacidade deve ser 1 (ocultar por padrão)!');
}
console.log('9. Padrão de privacidade verificado com sucesso: hide_medication_names = 1 (oculto por padrão).');

closeDatabase();
console.log('\n--- TODOS OS TESTES DA ETAPA 1 PASSARAM COM 100% DE SUCESSO! ---');
