import Database from 'better-sqlite3';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runVersionedMigrations } from './migrator.js';

const TEMP_DB_PATH = path.resolve('/tmp', `doses_test_concurrency_${Date.now()}.db`);
const MAX_RETRIES = 3;

// ============================================================================
// QUERIES SQL ATÔMICAS DO MECANISMO DE LEASE
// ============================================================================

// 1. Aquisição atômica de lease com validação estrita de retry_count < MAX_RETRIES e geração de lease_token
export const ATOMIC_ACQUIRE_LEASE_SQL = `
  UPDATE dose_occurrences
  SET status = 'DISPATCHING',
      lease_until = :leaseUntil,
      lease_token = :leaseToken,
      retry_count = retry_count + 1,
      updated_at = datetime('now')
  WHERE id = :occurrenceId
    AND retry_count < ${MAX_RETRIES}
    AND (
      status = 'SCHEDULED'
      OR (status = 'DISPATCHING' AND lease_until < :nowUtcMs)
      OR status = 'DISPATCH_FAILED'
    );
`;

// 2. Conclusão atômica: exige que o worker ainda seja o proprietário atual do lease_token
export const ATOMIC_COMPLETE_DISPATCH_SQL = `
  UPDATE dose_occurrences
  SET status = 'DISPATCHED',
      dispatched_at = datetime('now'),
      lease_until = NULL,
      updated_at = datetime('now')
  WHERE id = :occurrenceId
    AND lease_token = :leaseToken
    AND status = 'DISPATCHING';
`;

// 3. Esgotamento de tentativas: transição para estado terminal após falha máxima
export const ATOMIC_MARK_EXHAUSTED_SQL = `
  UPDATE dose_occurrences
  SET status = 'MISSED',
      lease_until = NULL,
      last_error = 'MAX_RETRIES_EXCEEDED',
      updated_at = datetime('now')
  WHERE id = :occurrenceId
    AND retry_count >= ${MAX_RETRIES}
    AND status IN ('DISPATCHING', 'DISPATCH_FAILED');
`;

// ============================================================================
// CÓDIGO DO WORKER THREAD
// ============================================================================
if (!isMainThread) {
  const { dbPath, occurrenceId, workerId, leaseDurationMs } = workerData;
  const db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');

  parentPort?.on('message', (msg) => {
    if (msg.action === 'ACQUIRE_LEASE') {
      const nowUtcMs = Date.now();
      const leaseUntil = nowUtcMs + leaseDurationMs;
      const leaseToken = crypto.randomUUID();

      const result = db.prepare(ATOMIC_ACQUIRE_LEASE_SQL).run({
        leaseUntil,
        leaseToken,
        nowUtcMs,
        occurrenceId,
      });

      parentPort?.postMessage({
        workerId,
        leaseToken: result.changes === 1 ? leaseToken : null,
        acquired: result.changes === 1,
      });
      db.close();
    }
  });
}

// ============================================================================
// THREAD PRINCIPAL (SUÍTE COMPLETA DE TESTES)
// ============================================================================
if (isMainThread) {
  async function runConcurrencyTests() {
    console.log('================================================================');
    console.log('  Validação do Mecanismo de Lease com Lease Token e Retries     ');
    console.log('================================================================');

    // 1. Cria e inicializa o banco temporário de teste
    const mainDb = new Database(TEMP_DB_PATH);
    mainDb.pragma('journal_mode = WAL');
    mainDb.pragma('foreign_keys = ON');
    mainDb.pragma('busy_timeout = 5000');

    runVersionedMigrations(mainDb);

    // 2. Prepara dados base de teste
    const accountId = 'acc_' + crypto.randomUUID();
    const profileId = 'prof_' + crypto.randomUUID();
    const medId = 'med_' + crypto.randomUUID();
    const timeId = 'time_' + crypto.randomUUID();
    const occurrenceId = 'occ_' + crypto.randomUUID();

    mainDb.prepare(`
      INSERT INTO accounts (id, username, password_hash, salt)
      VALUES (?, 'user_lease_test', 'hash', 'salt');
    `).run(accountId);

    mainDb.prepare(`
      INSERT INTO profiles (id, account_id, name, avatar)
      VALUES (?, ?, 'Paciente Lease', 'senior-person');
    `).run(profileId, accountId);

    mainDb.prepare(`
      INSERT INTO medications (id, profile_id, account_id, name)
      VALUES (?, ?, ?, 'Medicamento Teste Lease');
    `).run(medId, profileId, accountId);

    mainDb.prepare(`
      INSERT INTO medication_times (id, medication_id, profile_id, account_id, time)
      VALUES (?, ?, ?, ?, '08:00');
    `).run(timeId, medId, profileId, accountId);

    mainDb.prepare(`
      INSERT INTO dose_occurrences (
        id, medication_time_id, profile_id, account_id,
        scheduled_date, scheduled_time, timezone, scheduled_at_utc,
        schedule_version, status, retry_count
      ) VALUES (?, ?, ?, ?, '2026-11-04', '08:00', 'America/Sao_Paulo', ?, 1, 'SCHEDULED', 0);
    `).run(occurrenceId, timeId, profileId, accountId, Date.now());

    console.log('1. Banco temporário e dados de teste inicializados com migrações 001..003.');

    // --------------------------------------------------------------------------
    // CENÁRIO 1: Recuperação de Lease Expirado
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 1: Recuperação de Lease Expirado por Novo Worker ---');

    // Simula que Worker A pegou o lease e travou (lease_until no passado, retry_count = 1)
    const tokenA = crypto.randomUUID();
    mainDb.prepare(`
      UPDATE dose_occurrences
      SET status = 'DISPATCHING',
          lease_until = ?,
          lease_token = ?,
          retry_count = 1
      WHERE id = ?
    `).run(Date.now() - 5000, tokenA, occurrenceId);

    const now1 = Date.now();
    const tokenB = crypto.randomUUID();
    const rescueResult = mainDb.prepare(ATOMIC_ACQUIRE_LEASE_SQL).run({
      leaseUntil: now1 + 10000,
      leaseToken: tokenB,
      nowUtcMs: now1,
      occurrenceId,
    });

    if (rescueResult.changes !== 1) {
      throw new Error('Falha no Cenário 1: Novo worker não conseguiu recuperar ocorrência com lease expirado!');
    }

    const rowAfterRescue = mainDb.prepare(`SELECT status, lease_token, retry_count FROM dose_occurrences WHERE id = ?`).get(occurrenceId) as any;
    console.log(`Recuperado com sucesso! Novo lease_token: ${rowAfterRescue.lease_token.slice(0, 8)}..., retry_count: ${rowAfterRescue.retry_count}`);

    if (rowAfterRescue.lease_token !== tokenB || rowAfterRescue.retry_count !== 2) {
      throw new Error('Falha no Cenário 1: Token do lease ou retry_count não atualizados corretamente.');
    }
    console.log('CENÁRIO 1 APROVADO: Recuperação de lease expirado funcionou perfeitamente.');

    // --------------------------------------------------------------------------
    // CENÁRIO 2: Bloqueio de Recuperação após Esgotar Tentativas (retry_count >= 3)
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 2: Bloqueio de Recuperação após Esgotar Tentativas ---');

    // Simula que a ocorrência atingiu retry_count = 3 e o lease expirou novamente
    mainDb.prepare(`
      UPDATE dose_occurrences
      SET status = 'DISPATCHING',
          lease_until = ?,
          retry_count = 3
      WHERE id = ?
    `).run(Date.now() - 5000, occurrenceId);

    const now2 = Date.now();
    const tokenC = crypto.randomUUID();
    const blockedResult = mainDb.prepare(ATOMIC_ACQUIRE_LEASE_SQL).run({
      leaseUntil: now2 + 10000,
      leaseToken: tokenC,
      nowUtcMs: now2,
      occurrenceId,
    });

    if (blockedResult.changes !== 0) {
      throw new Error('Falha no Cenário 2: Ocorrência que esgotou retries permitiu nova aquisição indevida!');
    }

    // Transita formalmente para estado terminal MISSED
    mainDb.prepare(ATOMIC_MARK_EXHAUSTED_SQL).run({ occurrenceId });
    const terminalRow = mainDb.prepare(`SELECT status, last_error FROM dose_occurrences WHERE id = ?`).get(occurrenceId) as any;
    console.log(`Ocorrência esgotada transitou para status terminal: ${terminalRow.status} (erro: ${terminalRow.last_error})`);

    if (terminalRow.status !== 'MISSED') {
      throw new Error('Falha no Cenário 2: Ocorrência esgotada não foi marcada como MISSED.');
    }
    console.log('CENÁRIO 2 APROVADO: Bloqueio estrito de recuperação após esgotar retries.');

    // --------------------------------------------------------------------------
    // CENÁRIO 3: Worker Antigo Tentando Finalizar após Outro Worker Adquirir Novo Lease
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 3: Worker Zumbi/Antigo Tentando Finalizar com Token Antigo ---');

    // Reinicia ocorrência com retry_count = 1 em DISPATCHING para Worker 1 (tokenZumbi)
    const tokenZumbi = crypto.randomUUID();
    mainDb.prepare(`
      UPDATE dose_occurrences
      SET status = 'DISPATCHING',
          lease_until = ?,
          lease_token = ?,
          retry_count = 1
      WHERE id = ?
    `).run(Date.now() - 2000, tokenZumbi, occurrenceId); // Lease expirou

    // Worker 2 (legítimo) adquire novo lease válido com tokenValido
    const now3 = Date.now();
    const tokenValido = crypto.randomUUID();
    mainDb.prepare(ATOMIC_ACQUIRE_LEASE_SQL).run({
      leaseUntil: now3 + 15000,
      leaseToken: tokenValido,
      nowUtcMs: now3,
      occurrenceId,
    });

    // Agora o Worker Zumbi "acorda" atrasado e tenta finalizar usando tokenZumbi
    const zombieAttempt = mainDb.prepare(ATOMIC_COMPLETE_DISPATCH_SQL).run({
      occurrenceId,
      leaseToken: tokenZumbi,
    });

    if (zombieAttempt.changes !== 0) {
      throw new Error('Falha no Cenário 3: Worker zumbi com token antigo conseguiu finalizar a ocorrência!');
    }
    console.log('Tentativa do worker zumbi bloqueada com sucesso (0 linhas alteradas).');
    console.log('CENÁRIO 3 APROVADO: Impossível um worker antigo sobrescrever a execução de um worker mais recente.');

    // --------------------------------------------------------------------------
    // CENÁRIO 4: Worker Proprietário Atual Finalizando Normalmente
    // --------------------------------------------------------------------------
    console.log('\n--- CENÁRIO 4: Worker Proprietário Atual Finalizando com Sucesso ---');

    // Worker 2 legítimo finaliza usando seu tokenValido
    const validAttempt = mainDb.prepare(ATOMIC_COMPLETE_DISPATCH_SQL).run({
      occurrenceId,
      leaseToken: tokenValido,
    });

    if (validAttempt.changes !== 1) {
      throw new Error('Falha no Cenário 4: Worker legítimo não conseguiu finalizar a ocorrência!');
    }

    const finalRow = mainDb.prepare(`SELECT status, dispatched_at, lease_until FROM dose_occurrences WHERE id = ?`).get(occurrenceId) as any;
    console.log(`Estado final: status = ${finalRow.status}, dispatched_at = ${finalRow.dispatched_at}, lease_until = ${finalRow.lease_until}`);

    if (finalRow.status !== 'DISPATCHED' || finalRow.lease_until !== null) {
      throw new Error('Falha no Cenário 4: Ocorrência não finalizou com status DISPATCHED ou lease_until não foi limpo.');
    }
    console.log('CENÁRIO 4 APROVADO: Worker legítimo finalizou com sucesso.');

    // Limpeza
    mainDb.close();
    try {
      fs.unlinkSync(TEMP_DB_PATH);
      if (fs.existsSync(TEMP_DB_PATH + '-wal')) fs.unlinkSync(TEMP_DB_PATH + '-wal');
      if (fs.existsSync(TEMP_DB_PATH + '-shm')) fs.unlinkSync(TEMP_DB_PATH + '-shm');
    } catch (_) {}

    console.log('\n================================================================');
    console.log('  TODOS OS 4 CENÁRIOS DE LEASE E RETRY PASSARAM COM 100% SUCESSO!');
    console.log('================================================================');
  }

  runConcurrencyTests().catch((err) => {
    console.error('Erro crítico no teste:', err);
    process.exit(1);
  });
}
