import Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration: Migration = {
  version: '007',
  name: 'temporal_configuration_and_versioning',
  up: (db: Database.Database) => {
    // 1. Tabela de configuração temporal centralizada (Fonte de Verdade no SQLite)
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_temporal_settings (
          id TEXT PRIMARY KEY,                 -- Identificador fixo: 'current'
          timezone TEXT NOT NULL,             -- Ex: 'America/Sao_Paulo'
          temporal_version INTEGER NOT NULL DEFAULT 1, -- Incrementado a cada reconciliação
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 2. Inicialização com valor padrão se ainda não existir
    db.prepare(`
      INSERT OR IGNORE INTO app_temporal_settings (id, timezone, temporal_version)
      VALUES ('current', 'America/Sao_Paulo', 1)
    `).run();

    // 3. Adição da coluna `temporal_version` à tabela `dose_occurrences`
    // Verifica se a coluna já existe antes de adicionar
    const tableInfo = db.prepare(`PRAGMA table_info(dose_occurrences)`).all() as { name: string }[];
    const hasTemporalVersion = tableInfo.some((col) => col.name === 'temporal_version');

    if (!hasTemporalVersion) {
      db.exec(`
        ALTER TABLE dose_occurrences ADD COLUMN temporal_version INTEGER NOT NULL DEFAULT 1;
      `);
    }

    // 4. Reconstrução do índice único `idx_occurrences_slot` para incluir `temporal_version`
    // Isso garante que uma mudança de timezone (novo temporal_version) não colida com
    // ocorrências canceladas da versão temporal anterior.
    db.exec(`
      DROP INDEX IF EXISTS idx_occurrences_slot;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrences_slot 
      ON dose_occurrences(medication_time_id, scheduled_date, scheduled_time, schedule_version, temporal_version);
    `);
  },
};
