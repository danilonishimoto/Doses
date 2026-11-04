import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { softDeleteMedication, SoftDeleteResult } from './domainService.js';

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

export interface UpdateMedicationInput {
  name?: string;
  dosage?: string;
  recurrence?: string;
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
  ): { medication?: MedicationDto; error?: 'PROFILE_NOT_FOUND' } {
    // 1. Valida se o perfil existe, pertence à conta autenticada e não está excluído
    const profile = this.db.prepare(`
      SELECT id FROM profiles
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(profileId, accountId);

    if (!profile) {
      return { error: 'PROFILE_NOT_FOUND' };
    }

    const id = 'med_' + crypto.randomUUID();
    const name = input.name.trim();
    const dosage = (input.dosage || '').trim();
    const recurrence = (input.recurrence || 'DAILY').trim();

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
  ): MedicationDto | null {
    const existing = this.getMedicationById(accountId, medicationId);
    if (!existing) {
      return null;
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;
    const newDosage = input.dosage !== undefined ? input.dosage.trim() : existing.dosage;
    const newRecurrence = input.recurrence !== undefined ? input.recurrence.trim() : existing.recurrence;

    this.db.prepare(`
      UPDATE medications
      SET name = ?,
          dosage = ?,
          recurrence = ?,
          version = version + 1,
          updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).run(newName, newDosage, newRecurrence, medicationId, accountId);

    return this.getMedicationById(accountId, medicationId);
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
