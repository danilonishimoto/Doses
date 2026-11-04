import Database from 'better-sqlite3';

export const migration = {
  version: '001',
  name: 'initial_schema',
  up: (db: Database.Database) => {
    // 1. Contas de Usuário
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 2. Perfis de Pacientes
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
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
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 3. Medicamentos
    db.exec(`
      CREATE TABLE IF NOT EXISTS medications (
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
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 4. Horários dos Medicamentos
    db.exec(`
      CREATE TABLE IF NOT EXISTS medication_times (
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
          FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 5. Inscrições Web Push
    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          endpoint TEXT UNIQUE NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT NOT NULL DEFAULT '',
          hide_medication_names INTEGER NOT NULL DEFAULT 1,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 6. Sessões de Autenticação
    db.exec(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          refresh_token_hash TEXT UNIQUE NOT NULL,
          token_family TEXT NOT NULL,
          is_revoked INTEGER NOT NULL DEFAULT 0,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 7. Ocorrências Programadas de Lembretes
    db.exec(`
      CREATE TABLE IF NOT EXISTS dose_occurrences (
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
          dispatched_at TEXT,
          confirmed_at TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (medication_time_id) REFERENCES medication_times(id) ON DELETE RESTRICT,
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 8. Confirmações de Doses
    db.exec(`
      CREATE TABLE IF NOT EXISTS dose_confirmations (
          id TEXT PRIMARY KEY,
          occurrence_id TEXT UNIQUE NOT NULL,
          profile_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'TAKEN',
          confirmed_at TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'NOTIFICATION_ACTION',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (occurrence_id) REFERENCES dose_occurrences(id) ON DELETE RESTRICT,
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // Índices Iniciais
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrences_slot 
      ON dose_occurrences(medication_time_id, scheduled_date, scheduled_time, schedule_version);

      CREATE INDEX IF NOT EXISTS idx_occurrences_dispatch_search 
      ON dose_occurrences(status, scheduled_at_utc, lease_until);

      CREATE INDEX IF NOT EXISTS idx_subscriptions_account 
      ON push_subscriptions(account_id, is_active);

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_device 
      ON auth_sessions(account_id, device_id, is_revoked);
    `);
  },
};
