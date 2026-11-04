import Database from 'better-sqlite3';

export const migration = {
  version: '002',
  name: 'add_auth_sessions_family_index',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_family 
      ON auth_sessions(account_id, token_family, is_revoked);
    `);
  },
};
