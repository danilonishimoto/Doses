import Database from 'better-sqlite3';

export const migration = {
  version: '004',
  name: 'enhance_auth_sessions',
  up: (db: Database.Database) => {
    // Adiciona colunas para rastreamento de auditoria da rotação de tokens,
    // data de revogação explícita e substituição de hash para detecção de reuso.
    db.exec(`
      ALTER TABLE auth_sessions ADD COLUMN revoked_at TEXT;
      ALTER TABLE auth_sessions ADD COLUMN replaced_by_hash TEXT;
      ALTER TABLE auth_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
    `);
  },
};
