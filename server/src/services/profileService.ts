import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { softDeleteProfile, SoftDeleteResult } from './domainService.js';

export interface ProfileDto {
  id: string;
  accountId: string;
  name: string;
  surname: string;
  avatar: string;
  isMainProfile: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  name: string;
  surname?: string;
  avatar: string;
  isMainProfile?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  surname?: string;
  avatar?: string;
  isMainProfile?: boolean;
}

export class ProfileService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  createProfile(accountId: string, input: CreateProfileInput): ProfileDto {
    const id = 'prof_' + crypto.randomUUID();
    const name = input.name.trim();
    const surname = (input.surname || '').trim();
    const avatar = input.avatar.trim();
    const isMain = input.isMainProfile ? 1 : 0;

    const runTx = this.db.transaction(() => {
      // Se este perfil for marcado como principal, desmarca eventuais outros ativos da mesma conta
      if (isMain === 1) {
        this.db.prepare(`
          UPDATE profiles
          SET is_main_profile = 0, updated_at = datetime('now')
          WHERE account_id = ? AND is_deleted = 0
        `).run(accountId);
      }

      this.db.prepare(`
        INSERT INTO profiles (
          id, account_id, name, surname, avatar, is_main_profile, is_deleted, version, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'), datetime('now')
        )
      `).run(id, accountId, name, surname, avatar, isMain);
    });

    runTx();

    return this.getProfileById(accountId, id)!;
  }

  listProfiles(accountId: string): ProfileDto[] {
    const rows = this.db.prepare(`
      SELECT id, account_id, name, surname, avatar, is_main_profile, version, created_at, updated_at
      FROM profiles
      WHERE account_id = ? AND is_deleted = 0
      ORDER BY is_main_profile DESC, created_at ASC
    `).all(accountId) as any[];

    return rows.map((r) => this.mapRowToDto(r));
  }

  getProfileById(accountId: string, profileId: string): ProfileDto | null {
    const row = this.db.prepare(`
      SELECT id, account_id, name, surname, avatar, is_main_profile, version, created_at, updated_at
      FROM profiles
      WHERE id = ? AND account_id = ? AND is_deleted = 0
    `).get(profileId, accountId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToDto(row);
  }

  updateProfile(accountId: string, profileId: string, input: UpdateProfileInput): ProfileDto | null {
    const existing = this.getProfileById(accountId, profileId);
    if (!existing) {
      return null;
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;
    const newSurname = input.surname !== undefined ? input.surname.trim() : existing.surname;
    const newAvatar = input.avatar !== undefined ? input.avatar.trim() : existing.avatar;
    const newIsMain = input.isMainProfile !== undefined ? (input.isMainProfile ? 1 : 0) : (existing.isMainProfile ? 1 : 0);

    const runTx = this.db.transaction(() => {
      if (newIsMain === 1) {
        this.db.prepare(`
          UPDATE profiles
          SET is_main_profile = 0, updated_at = datetime('now')
          WHERE account_id = ? AND id != ? AND is_deleted = 0
        `).run(accountId, profileId);
      }

      this.db.prepare(`
        UPDATE profiles
        SET name = ?,
            surname = ?,
            avatar = ?,
            is_main_profile = ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? AND account_id = ? AND is_deleted = 0
      `).run(newName, newSurname, newAvatar, newIsMain, profileId, accountId);
    });

    runTx();

    return this.getProfileById(accountId, profileId);
  }

  deleteProfile(accountId: string, profileId: string): SoftDeleteResult {
    return softDeleteProfile(this.db, accountId, profileId);
  }

  private mapRowToDto(row: any): ProfileDto {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      surname: row.surname || '',
      avatar: row.avatar,
      isMainProfile: Boolean(row.is_main_profile),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
