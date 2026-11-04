import Database from 'better-sqlite3';

export interface SoftDeleteResult {
  success: boolean;
  cancelledOccurrencesCount: number;
  error?: 'PROFILE_NOT_FOUND' | 'MEDICATION_NOT_FOUND' | 'MEDICATION_TIME_NOT_FOUND' | 'UNAUTHORIZED_OR_NOT_FOUND';
}

/**
 * Exclusão lógica de perfil com cancelamento atômico de ocorrências futuras elegíveis.
 * 
 * Regras:
 * 1. Valida que o perfil pertence à conta autenticada e está ativo (is_deleted = 0).
 * 2. Atualiza is_deleted = 1 e deleted_at = datetime('now') no perfil.
 * 3. Atualiza em cascata medicamentos e horários do perfil como is_deleted = 1.
 * 4. Transita para 'CANCELLED' todas as ocorrências elegíveis:
 *    - Status 'SCHEDULED' (aguardando horário futuro).
 *    - Status 'DISPATCH_FAILED' (aguardando retentativa, que agora é desnecessária).
 *    - Status 'DISPATCHING' cujo lease já tenha expirado (worker zumbi/abandonado).
 * 5. PRESERVA intactas ocorrências históricas e terminais:
 *    - 'CONFIRMED' (dose tomada).
 *    - 'DISPATCHED' (já enviada ao dispositivo).
 *    - 'MISSED' (não confirmada/expirada).
 * 6. Ocorrências com lease ativo em 'DISPATCHING' (lease_until > now) não são
 *    adulteradas para preservar o fencing token do worker em voo. O futuro scheduler
 *    verificará 'is_deleted = 0' como segunda barreira antes de despachar.
 * 7. Execução 100% transacional: se houver falha, ocorre rollback completo.
 */
export function softDeleteProfile(
  db: Database.Database,
  accountId: string,
  profileId: string
): SoftDeleteResult {
  const profile = db.prepare(`
    SELECT id, account_id, is_deleted
    FROM profiles
    WHERE id = ? AND account_id = ? AND is_deleted = 0
  `).get(profileId, accountId) as { id: string; account_id: string; is_deleted: number } | undefined;

  if (!profile) {
    return {
      success: false,
      cancelledOccurrencesCount: 0,
      error: 'UNAUTHORIZED_OR_NOT_FOUND',
    };
  }

  const nowMs = Date.now();

  const runTx = db.transaction(() => {
    // 1. Marca o perfil como excluído
    db.prepare(`
      UPDATE profiles
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(profileId, accountId);

    // 2. Marca medicamentos do perfil como excluídos
    db.prepare(`
      UPDATE medications
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE profile_id = ? AND account_id = ? AND is_deleted = 0
    `).run(profileId, accountId);

    // 3. Marca horários de medicamentos como excluídos
    db.prepare(`
      UPDATE medication_times
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE profile_id = ? AND account_id = ? AND is_deleted = 0
    `).run(profileId, accountId);

    // 4. Cancela ocorrências futuras elegíveis
    const cancelStmt = db.prepare(`
      UPDATE dose_occurrences
      SET status = 'CANCELLED',
          updated_at = datetime('now')
      WHERE account_id = ?
        AND profile_id = ?
        AND (
          status IN ('SCHEDULED', 'DISPATCH_FAILED')
          OR (status = 'DISPATCHING' AND (lease_until IS NULL OR lease_until <= ?))
        )
    `);

    const result = cancelStmt.run(accountId, profileId, nowMs);
    return result.changes;
  });

  const cancelledCount = runTx();

  return {
    success: true,
    cancelledOccurrencesCount: cancelledCount,
  };
}

/**
 * Exclusão lógica de medicamento com cancelamento atômico de ocorrências futuras elegíveis.
 * 
 * Regras:
 * 1. Valida propriedade da conta e status ativo (is_deleted = 0).
 * 2. Atualiza is_deleted = 1 e deleted_at = datetime('now') no medicamento.
 * 3. Atualiza em cascata os horários (medication_times) do medicamento como is_deleted = 1.
 * 4. Transita para 'CANCELLED' ocorrências em 'SCHEDULED', 'DISPATCH_FAILED' ou 'DISPATCHING' com lease expirado.
 * 5. Preserva ocorrências 'CONFIRMED', 'DISPATCHED' e 'MISSED'.
 * 6. Atômico e transacional.
 */
export function softDeleteMedication(
  db: Database.Database,
  accountId: string,
  medicationId: string
): SoftDeleteResult {
  const med = db.prepare(`
    SELECT id, profile_id, account_id, is_deleted
    FROM medications
    WHERE id = ? AND account_id = ? AND is_deleted = 0
  `).get(medicationId, accountId) as { id: string; profile_id: string; account_id: string; is_deleted: number } | undefined;

  if (!med) {
    return {
      success: false,
      cancelledOccurrencesCount: 0,
      error: 'UNAUTHORIZED_OR_NOT_FOUND',
    };
  }

  const nowMs = Date.now();

  const runTx = db.transaction(() => {
    // 1. Marca medicamento como excluído
    db.prepare(`
      UPDATE medications
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(medicationId, accountId);

    // 2. Marca horários como excluídos
    db.prepare(`
      UPDATE medication_times
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE medication_id = ? AND account_id = ? AND is_deleted = 0
    `).run(medicationId, accountId);

    // 3. Cancela ocorrências futuras elegíveis vinculadas aos horários deste medicamento
    const cancelStmt = db.prepare(`
      UPDATE dose_occurrences
      SET status = 'CANCELLED',
          updated_at = datetime('now')
      WHERE account_id = ?
        AND medication_time_id IN (SELECT id FROM medication_times WHERE medication_id = ?)
        AND (
          status IN ('SCHEDULED', 'DISPATCH_FAILED')
          OR (status = 'DISPATCHING' AND (lease_until IS NULL OR lease_until <= ?))
        )
    `);

    const result = cancelStmt.run(accountId, medicationId, nowMs);
    return result.changes;
  });

  const cancelledCount = runTx();

  return {
    success: true,
    cancelledOccurrencesCount: cancelledCount,
  };
}

/**
 * Exclusão lógica de horário de medicamento com cancelamento atômico de ocorrências futuras elegíveis.
 * 
 * Regras:
 * 1. Valida propriedade da conta e status ativo (is_deleted = 0).
 * 2. Atualiza is_deleted = 1 e deleted_at = datetime('now') no horário.
 * 3. Transita para 'CANCELLED' ocorrências em 'SCHEDULED', 'DISPATCH_FAILED' ou 'DISPATCHING' com lease expirado.
 * 4. Preserva ocorrências 'CONFIRMED', 'DISPATCHED' e 'MISSED'.
 * 5. Atômico e transacional.
 */
export function softDeleteMedicationTime(
  db: Database.Database,
  accountId: string,
  timeId: string
): SoftDeleteResult {
  const timeRow = db.prepare(`
    SELECT id, medication_id, profile_id, account_id, is_deleted
    FROM medication_times
    WHERE id = ? AND account_id = ? AND is_deleted = 0
  `).get(timeId, accountId) as { id: string; medication_id: string; profile_id: string; account_id: string; is_deleted: number } | undefined;

  if (!timeRow) {
    return {
      success: false,
      cancelledOccurrencesCount: 0,
      error: 'UNAUTHORIZED_OR_NOT_FOUND',
    };
  }

  const nowMs = Date.now();

  const runTx = db.transaction(() => {
    // 1. Marca horário como excluído
    db.prepare(`
      UPDATE medication_times
      SET is_deleted = 1,
          deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(timeId, accountId);

    // 2. Cancela ocorrências futuras elegíveis para este horário
    const cancelStmt = db.prepare(`
      UPDATE dose_occurrences
      SET status = 'CANCELLED',
          updated_at = datetime('now')
      WHERE account_id = ?
        AND medication_time_id = ?
        AND (
          status IN ('SCHEDULED', 'DISPATCH_FAILED')
          OR (status = 'DISPATCHING' AND (lease_until IS NULL OR lease_until <= ?))
        )
    `);

    const result = cancelStmt.run(accountId, timeId, nowMs);
    return result.changes;
  });

  const cancelledCount = runTx();

  return {
    success: true,
    cancelledOccurrencesCount: cancelledCount,
  };
}
