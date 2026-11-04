import Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration: Migration = {
  version: '008',
  name: 'occurrence_dispatches_tracking',
  up: (db: Database.Database) => {
    // Tabela de rastreamento de envios Web Push por dispositivo/inscrição
    // Permite rastrear entregas individuais em contas com múltiplos dispositivos,
    // evitando reenvios duplicados para dispositivos que já receberam a notificação em caso de retry.
    db.exec(`
      CREATE TABLE IF NOT EXISTS dose_occurrence_dispatches (
          id TEXT PRIMARY KEY,
          occurrence_id TEXT NOT NULL,
          subscription_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          device_name TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL CHECK(status IN ('SENT', 'FAILED')),
          status_code INTEGER,
          error_message TEXT,
          attempt_count INTEGER NOT NULL DEFAULT 1,
          sent_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (occurrence_id) REFERENCES dose_occurrences(id) ON DELETE CASCADE,
          FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
          UNIQUE (occurrence_id, subscription_id)
      );

      CREATE INDEX IF NOT EXISTS idx_occurrence_dispatches_lookup
      ON dose_occurrence_dispatches(occurrence_id, subscription_id, status);
    `);
  },
};
