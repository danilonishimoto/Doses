import Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration: Migration = {
  version: '009',
  name: 'create_prescriptions',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prescriptions (
          id TEXT PRIMARY KEY,
          profile_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          specialty TEXT NOT NULL,
          doctor_name TEXT NOT NULL,
          crm TEXT NOT NULL DEFAULT '',
          clinic_or_hospital TEXT NOT NULL DEFAULT '',
          emission_date TEXT NOT NULL,
          expiration_date TEXT NOT NULL DEFAULT '',
          medications_json TEXT NOT NULL DEFAULT '[]',
          instructions TEXT NOT NULL DEFAULT '',
          card_color TEXT NOT NULL DEFAULT '#B4ECFB',
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (profile_id, account_id) REFERENCES profiles(id, account_id) ON DELETE CASCADE,
          UNIQUE (id, profile_id, account_id)
      );

      CREATE INDEX IF NOT EXISTS idx_prescriptions_profile
      ON prescriptions(profile_id, account_id, is_deleted);
    `);
  },
};
