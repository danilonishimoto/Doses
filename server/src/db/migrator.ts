import Database from 'better-sqlite3';
import { migration as migration001 } from './migrations/001_initial_schema.js';
import { migration as migration002 } from './migrations/002_add_auth_sessions_family_index.js';
import { migration as migration003 } from './migrations/003_add_lease_token_to_occurrences.js';
import { migration as migration004 } from './migrations/004_enhance_auth_sessions.js';

export interface Migration {
  version: string;
  name: string;
  up: (db: Database.Database) => void;
}

export const ALL_MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
];

export function runVersionedMigrations(db: Database.Database): { applied: string[]; skipped: string[] } {
  // 1. Cria a tabela de controle de versão se não existir
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 2. Consulta migrações já aplicadas
  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: string }[];
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  const newlyApplied: string[] = [];
  const skipped: string[] = [];

  for (const m of ALL_MIGRATIONS) {
    if (appliedSet.has(m.version)) {
      skipped.push(m.version);
      continue;
    }

    console.log(`[Migrator] Aplicando migração ${m.version}: ${m.name}...`);

    // Executa a migração em transação atômica
    const applyTx = db.transaction(() => {
      m.up(db);
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, datetime('now'))
      `).run(m.version, m.name);
    });

    applyTx();
    newlyApplied.push(m.version);
    console.log(`[Migrator] Migração ${m.version} aplicada com sucesso.`);
  }

  return { applied: newlyApplied, skipped };
}
