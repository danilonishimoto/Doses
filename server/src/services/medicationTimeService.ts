import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { softDeleteMedicationTime, SoftDeleteResult } from './domainService.js';

export interface MedicationTimeDto {
  id: string;
  medicationId: string;
  profileId: string;
  accountId: string;
  time: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicationTimeInput {
  time: string; // Formato 'HH:mm'
}

export interface UpdateMedicationTimeInput {
  time: string; // Formato 'HH:mm'
}

export class MedicationTimeService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  createMedicationTime(
    accountId: string,
    medicationId: string,
    input: CreateMedicationTimeInput
  ): { time?: MedicationTimeDto; error?: 'MEDICATION_NOT_FOUND' | 'DUPLICATE_TIME' } {
    // 1. Valida se o medicamento existe, pertence à conta autenticada e está ativo
    const med = this.db.prepare(`
      SELECT id, profile_id
      FROM medications
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(medicationId, accountId) as { id: string; profile_id: string } | undefined;

    if (!med) {
      return { error: 'MEDICATION_NOT_FOUND' };
    }

    const cleanTime = input.time.trim();

    // 2. Impede cadastro de horário duplicado para o mesmo medicamento ativo
    const existing = this.db.prepare(`
      SELECT count(*) as count
      FROM medication_times
      WHERE medication_id = ? AND account_id = ? AND time = ? AND is_deleted = 0
    `).get(medicationId, accountId, cleanTime) as { count: number };

    if (existing.count > 0) {
      return { error: 'DUPLICATE_TIME' };
    }

    const id = 'time_' + crypto.randomUUID();

    this.db.prepare(`
      INSERT INTO medication_times (
        id, medication_id, profile_id, account_id, time, is_deleted, version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now')
      )
    `).run(id, medicationId, med.profile_id, accountId, cleanTime);

    const created = this.getMedicationTimeById(accountId, id);
    return { time: created! };
  }

  listMedicationTimes(accountId: string, medicationId: string): MedicationTimeDto[] | null {
    // Verifica se o medicamento pertence à conta autenticada e está ativo
    const med = this.db.prepare(`
      SELECT id
      FROM medications
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(medicationId, accountId);

    if (!med) {
      return null;
    }

    const rows = this.db.prepare(`
      SELECT id, medication_id, profile_id, account_id, time, version, created_at, updated_at
      FROM medication_times
      WHERE medication_id = ? AND account_id = ? AND is_deleted = 0
      ORDER BY time ASC
    `).all(medicationId, accountId) as any[];

    return rows.map((r) => this.mapRowToDto(r));
  }

  getMedicationTimeById(accountId: string, timeId: string): MedicationTimeDto | null {
    const row = this.db.prepare(`
      SELECT id, medication_id, profile_id, account_id, time, version, created_at, updated_at
      FROM medication_times
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(timeId, accountId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToDto(row);
  }

  updateMedicationTime(
    accountId: string,
    timeId: string,
    input: UpdateMedicationTimeInput
  ): { time?: MedicationTimeDto; error?: 'NOT_FOUND' | 'DUPLICATE_TIME' } {
    const existing = this.getMedicationTimeById(accountId, timeId);
    if (!existing) {
      return { error: 'NOT_FOUND' };
    }

    const cleanTime = input.time.trim();

    // Verifica se o novo horário já existe em outro registro ativo para o mesmo medicamento
    const duplicate = this.db.prepare(`
      SELECT count(*) as count
      FROM medication_times
      WHERE medication_id = ? AND account_id = ? AND time = ? AND id != ? AND is_deleted = 0
    `).get(existing.medicationId, accountId, cleanTime, timeId) as { count: number };

    if (duplicate.count > 0) {
      return { error: 'DUPLICATE_TIME' };
    }

    this.db.prepare(`
      UPDATE medication_times
      SET time = ?,
          version = version + 1,
          updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).run(cleanTime, timeId, accountId);

    const updated = this.getMedicationTimeById(accountId, timeId);
    return { time: updated! };
  }

  deleteMedicationTime(accountId: string, timeId: string): SoftDeleteResult {
    return softDeleteMedicationTime(this.db, accountId, timeId);
  }

  private mapRowToDto(row: any): MedicationTimeDto {
    return {
      id: row.id,
      medicationId: row.medication_id,
      profileId: row.profile_id,
      accountId: row.account_id,
      time: row.time,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
