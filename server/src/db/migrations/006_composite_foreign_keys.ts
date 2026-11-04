import Database from 'better-sqlite3';

export const migration = {
  version: '006',
  name: 'composite_foreign_keys',
  disableForeignKeysDuringMigration: true,
  up: (db: Database.Database) => {
    // 1. Verificação prévia de saneamento de dados legados.
    // Se existirem inconsistências no banco antes da migração, interrompe com erro
    // para que nenhuma exclusão ou decisão arbitrária de prevalência ocorra sem auditoria.
    const inconsistentMeds = db.prepare(`
      SELECT m.id, m.account_id AS med_acc, p.account_id AS prof_acc
      FROM medications m
      JOIN profiles p ON m.profile_id = p.id
      WHERE m.account_id != p.account_id
    `).all();

    if (inconsistentMeds.length > 0) {
      throw new Error(
        `[Migration 006] Inconsistência detectada entre medications e profiles: ${inconsistentMeds.length} registro(s) inconsistente(s). Migração abortada.`
      );
    }

    const inconsistentTimes = db.prepare(`
      SELECT mt.id, mt.profile_id AS time_prof, m.profile_id AS med_prof, mt.account_id AS time_acc, m.account_id AS med_acc
      FROM medication_times mt
      JOIN medications m ON mt.medication_id = m.id
      WHERE mt.profile_id != m.profile_id OR mt.account_id != m.account_id
    `).all();

    if (inconsistentTimes.length > 0) {
      throw new Error(
        `[Migration 006] Inconsistência detectada entre medication_times e medications: ${inconsistentTimes.length} registro(s) inconsistente(s). Migração abortada.`
      );
    }

    const inconsistentOccurrences = db.prepare(`
      SELECT o.id, o.profile_id AS occ_prof, mt.profile_id AS time_prof, o.account_id AS occ_acc, mt.account_id AS time_acc
      FROM dose_occurrences o
      JOIN medication_times mt ON o.medication_time_id = mt.id
      WHERE o.profile_id != mt.profile_id OR o.account_id != mt.account_id
    `).all();

    if (inconsistentOccurrences.length > 0) {
      throw new Error(
        `[Migration 006] Inconsistência detectada entre dose_occurrences e medication_times: ${inconsistentOccurrences.length} registro(s) inconsistente(s). Migração abortada.`
      );
    }

    const inconsistentConfirmations = db.prepare(`
      SELECT c.id, c.profile_id AS conf_prof, o.profile_id AS occ_prof, c.account_id AS conf_acc, o.account_id AS occ_acc
      FROM dose_confirmations c
      JOIN dose_occurrences o ON c.occurrence_id = o.id
      WHERE c.profile_id != o.profile_id OR c.account_id != o.account_id
    `).all();

    if (inconsistentConfirmations.length > 0) {
      throw new Error(
        `[Migration 006] Inconsistência detectada entre dose_confirmations e dose_occurrences: ${inconsistentConfirmations.length} registro(s) inconsistente(s). Migração abortada.`
      );
    }

    // 2. Reconstrução da tabela `profiles` com UNIQUE (id, account_id)
    db.exec(`
      CREATE TABLE profiles_new (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          name TEXT NOT NULL,
          surname TEXT NOT NULL DEFAULT '',
          avatar TEXT NOT NULL,
          is_main_profile INTEGER NOT NULL DEFAULT 0,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          UNIQUE (id, account_id)
      );

      INSERT INTO profiles_new (
          id, account_id, name, surname, avatar, is_main_profile,
          is_deleted, deleted_at, version, created_at, updated_at
      )
      SELECT 
          id, account_id, name, surname, avatar, is_main_profile,
          is_deleted, deleted_at, version, created_at, updated_at
      FROM profiles;

      DROP TABLE profiles;
      ALTER TABLE profiles_new RENAME TO profiles;
    `);

    // 3. Reconstrução da tabela `medications` com FK (profile_id, account_id) -> profiles(id, account_id)
    // e UNIQUE (id, profile_id, account_id)
    db.exec(`
      CREATE TABLE medications_new (
          id TEXT PRIMARY KEY,
          profile_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          name TEXT NOT NULL,
          dosage TEXT NOT NULL DEFAULT '',
          recurrence TEXT NOT NULL DEFAULT 'DAILY',
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (profile_id, account_id) REFERENCES profiles(id, account_id) ON DELETE CASCADE,
          UNIQUE (id, profile_id, account_id)
      );

      INSERT INTO medications_new (
          id, profile_id, account_id, name, dosage, recurrence,
          is_deleted, deleted_at, version, created_at, updated_at
      )
      SELECT 
          id, profile_id, account_id, name, dosage, recurrence,
          is_deleted, deleted_at, version, created_at, updated_at
      FROM medications;

      DROP TABLE medications;
      ALTER TABLE medications_new RENAME TO medications;
    `);

    // 4. Reconstrução da tabela `medication_times` com FK (medication_id, profile_id, account_id) -> medications(id, profile_id, account_id)
    // e UNIQUE (id, profile_id, account_id)
    db.exec(`
      CREATE TABLE medication_times_new (
          id TEXT PRIMARY KEY,
          medication_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          time TEXT NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          deleted_at TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (medication_id, profile_id, account_id) REFERENCES medications(id, profile_id, account_id) ON DELETE CASCADE,
          UNIQUE (id, profile_id, account_id)
      );

      INSERT INTO medication_times_new (
          id, medication_id, profile_id, account_id, time,
          is_deleted, deleted_at, version, created_at, updated_at
      )
      SELECT 
          id, medication_id, profile_id, account_id, time,
          is_deleted, deleted_at, version, created_at, updated_at
      FROM medication_times;

      DROP TABLE medication_times;
      ALTER TABLE medication_times_new RENAME TO medication_times;
    `);

    // 5. Reconstrução da tabela `dose_occurrences` com FK (medication_time_id, profile_id, account_id) -> medication_times(id, profile_id, account_id)
    // e UNIQUE (id, profile_id, account_id)
    db.exec(`
      CREATE TABLE dose_occurrences_new (
          id TEXT PRIMARY KEY,
          medication_time_id TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          scheduled_date TEXT NOT NULL,
          scheduled_time TEXT NOT NULL,
          timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
          scheduled_at_utc INTEGER NOT NULL,
          schedule_version INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL CHECK(status IN (
              'SCHEDULED', 'DISPATCHING', 'DISPATCHED', 'DISPATCH_FAILED',
              'CONFIRMED', 'MISSED', 'CANCELLED'
          )),
          lease_until INTEGER,
          lease_token TEXT,
          dispatched_at TEXT,
          confirmed_at TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (medication_time_id, profile_id, account_id) REFERENCES medication_times(id, profile_id, account_id) ON DELETE RESTRICT,
          UNIQUE (id, profile_id, account_id)
      );

      INSERT INTO dose_occurrences_new (
          id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time,
          timezone, scheduled_at_utc, schedule_version, status, lease_until, lease_token,
          dispatched_at, confirmed_at, retry_count, last_error, created_at, updated_at
      )
      SELECT 
          id, medication_time_id, profile_id, account_id, scheduled_date, scheduled_time,
          timezone, scheduled_at_utc, schedule_version, status, lease_until, lease_token,
          dispatched_at, confirmed_at, retry_count, last_error, created_at, updated_at
      FROM dose_occurrences;

      DROP TABLE dose_occurrences;
      ALTER TABLE dose_occurrences_new RENAME TO dose_occurrences;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrences_slot 
      ON dose_occurrences(medication_time_id, scheduled_date, scheduled_time, schedule_version);

      CREATE INDEX IF NOT EXISTS idx_occurrences_dispatch_search 
      ON dose_occurrences(status, scheduled_at_utc, lease_until);
    `);

    // 6. Reconstrução da tabela `dose_confirmations` com FK (occurrence_id, profile_id, account_id) -> dose_occurrences(id, profile_id, account_id)
    db.exec(`
      CREATE TABLE dose_confirmations_new (
          id TEXT PRIMARY KEY,
          occurrence_id TEXT UNIQUE NOT NULL,
          profile_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'TAKEN',
          confirmed_at TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'NOTIFICATION_ACTION',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (occurrence_id, profile_id, account_id) REFERENCES dose_occurrences(id, profile_id, account_id) ON DELETE RESTRICT
      );

      INSERT INTO dose_confirmations_new (
          id, occurrence_id, profile_id, account_id, status, confirmed_at, source, created_at
      )
      SELECT 
          id, occurrence_id, profile_id, account_id, status, confirmed_at, source, created_at
      FROM dose_confirmations;

      DROP TABLE dose_confirmations;
      ALTER TABLE dose_confirmations_new RENAME TO dose_confirmations;
    `);
  },
};
