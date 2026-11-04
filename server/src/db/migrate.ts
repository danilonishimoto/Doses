import Database from 'better-sqlite3';
import { getDatabase, closeDatabase } from './connection.js';
import { runVersionedMigrations } from './migrator.js';

export function runMigrations(target?: Database.Database | string): { applied: string[]; skipped: string[] } {
  const db = target instanceof Database ? target : getDatabase(typeof target === 'string' ? target : undefined);

  try {
    console.log('[Migrations] Verificando e aplicando migrações versionadas...');
    const result = runVersionedMigrations(db);
    console.log(`[Migrations] Concluído. Novas aplicadas: [${result.applied.join(', ')}], Já existentes: [${result.skipped.join(', ')}]`);
    return result;
  } catch (error) {
    console.error('[Migrations] Erro crítico ao aplicar migrações versionadas:', error);
    throw error;
  }
}

// Execução direta via CLI: npm run migrate
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  try {
    runMigrations();
    closeDatabase();
    process.exit(0);
  } catch (err) {
    closeDatabase();
    process.exit(1);
  }
}
