import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { softDeleteMedication, SoftDeleteResult } from './domainService.js';
import { validateRecurrence } from '../utils/recurrenceValidator.js';

export interface MedicationDto {
  id: string;
  profileId: string;
  accountId: string;
  name: string;
  dosage: string;
  recurrence: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicationInput {
  name: string;
  dosage?: string;
  recurrence?: string;
}

export interface CreateMedicationResult {
  medication?: MedicationDto;
  error?: 'PROFILE_NOT_FOUND' | 'INVALID_RECURRENCE';
  errorMessage?: string;
}

export interface UpdateMedicationInput {
  name?: string;
  dosage?: string;
  recurrence?: string;
  expectedVersion?: number;
}

export interface UpdateMedicationResult {
  medication?: MedicationDto;
  error?: 'NOT_FOUND' | 'VERSION_CONFLICT' | 'INVALID_RECURRENCE';
  errorMessage?: string;
  cancelledOccurrencesCount?: number;
}

export class MedicationService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  createMedication(
    accountId: string,
    profileId: string,
    input: CreateMedicationInput
  ): CreateMedicationResult {
    // 1. Valida se o perfil existe, pertence à conta autenticada e não está excluído
    const profile = this.db.prepare(`
      SELECT id FROM profiles
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(profileId, accountId);

    if (!profile) {
      return { error: 'PROFILE_NOT_FOUND' };
    }

    // 2. Validação estrita da regra de recorrência
    let recurrence = 'DAILY';
    if (input.recurrence !== undefined) {
      const valRes = validateRecurrence(input.recurrence);
      if (!valRes.valid) {
        return {
          error: 'INVALID_RECURRENCE',
          errorMessage: valRes.error,
        };
      }
      recurrence = valRes.normalized!;
    }

    const id = 'med_' + crypto.randomUUID();
    const name = input.name.trim();
    const dosage = (input.dosage || '').trim();

    this.db.prepare(`
      INSERT INTO medications (
        id, profile_id, account_id, name, dosage, recurrence, is_deleted, version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now')
      )
    `).run(id, profileId, accountId, name, dosage, recurrence);

    const created = this.getMedicationById(accountId, id);
    return { medication: created! };
  }

  listMedicationsByProfile(accountId: string, profileId: string): MedicationDto[] | null {
    // Verifica se o perfil existe e pertence à conta autenticada
    const profile = this.db.prepare(`
      SELECT id FROM profiles
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(profileId, accountId);

    if (!profile) {
      return null;
    }

    const rows = this.db.prepare(`
      SELECT id, profile_id, account_id, name, dosage, recurrence, version, created_at, updated_at
      FROM medications
      WHERE profile_id = ? AND account_id = ? AND is_deleted = 0
      ORDER BY name ASC, created_at ASC
    `).all(profileId, accountId) as any[];

    return rows.map((r) => this.mapRowToDto(r));
  }

  getMedicationById(accountId: string, medicationId: string): MedicationDto | null {
    const row = this.db.prepare(`
      SELECT id, profile_id, account_id, name, dosage, recurrence, version, created_at, updated_at
      FROM medications
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(medicationId, accountId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToDto(row);
  }

  updateMedication(
    accountId: string,
    medicationId: string,
    input: UpdateMedicationInput
  ): UpdateMedicationResult {
    const existing = this.getMedicationById(accountId, medicationId);
    if (!existing) {
      return { error: 'NOT_FOUND' };
    }

    // Controle otimista de versão
    if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) {
      return { error: 'VERSION_CONFLICT' };
    }

    // Validação estrita da recorrência se fornecida
    let newRecurrence = existing.recurrence;
    if (input.recurrence !== undefined) {
      const valRes = validateRecurrence(input.recurrence);
      if (!valRes.valid) {
        return {
          error: 'INVALID_RECURRENCE',
          errorMessage: valRes.error,
        };
      }
      newRecurrence = valRes.normalized!;
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;
    const newDosage = input.dosage !== undefined ? input.dosage.trim() : existing.dosage;
    const recurrenceChanged = newRecurrence !== existing.recurrence;

    const nowMs = Date.now();
    let cancelledCount = 0;

    const runTx = this.db.transaction(() => {
      // 1. Atualiza o medicamento com incremento de versão
      this.db.prepare(`
        UPDATE medications
        SET name = ?,
            dosage = ?,
            recurrence = ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? AND account_id = ? AND is_deleted = 0
      `).run(newName, newDosage, newRecurrence, medicationId, accountId);

      // 2. Se a recorrência mudou, os horários existentes precisam ter sua versão incrementada
      // e todas as ocorrências futuras elegíveis antigas devem ser canceladas atomicamente
      if (recurrenceChanged) {
        this.db.prepare(`
          UPDATE medication_times
          SET version = version + 1,
              updated_at = datetime('now')
          WHERE medication_id = ? AND account_id = ? AND is_deleted = 0
        `).run(medicationId, accountId);

        const cancelStmt = this.db.prepare(`
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
        cancelledCount = result.changes;
      }
    });

    runTx();

    const updated = this.getMedicationById(accountId, medicationId);
    return {
      medication: updated!,
      cancelledOccurrencesCount: cancelledCount,
    };
  }

  deleteMedication(accountId: string, medicationId: string): SoftDeleteResult {
    return softDeleteMedication(this.db, accountId, medicationId);
  }

  private mapRowToDto(row: any): MedicationDto {
    return {
      id: row.id,
      profileId: row.profile_id,
      accountId: row.account_id,
      name: row.name,
      dosage: row.dosage || '',
      recurrence: row.recurrence,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
