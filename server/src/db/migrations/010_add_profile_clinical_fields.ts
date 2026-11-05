import Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration: Migration = {
  version: '010',
  name: 'add_profile_clinical_fields',
  up: (db: Database.Database) => {
    const columns = db.pragma('table_info(profiles)') as { name: string }[];
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('age')) {
      db.exec("ALTER TABLE profiles ADD COLUMN age INTEGER NOT NULL DEFAULT 0;");
    }
    if (!colNames.has('weight')) {
      db.exec("ALTER TABLE profiles ADD COLUMN weight REAL NOT NULL DEFAULT 0;");
    }
    if (!colNames.has('height')) {
      db.exec("ALTER TABLE profiles ADD COLUMN height REAL NOT NULL DEFAULT 0;");
    }
    if (!colNames.has('medical_conditions')) {
      db.exec("ALTER TABLE profiles ADD COLUMN medical_conditions TEXT NOT NULL DEFAULT '';");
    }
    if (!colNames.has('allergies')) {
      db.exec("ALTER TABLE profiles ADD COLUMN allergies TEXT NOT NULL DEFAULT '';");
    }
  },
};
