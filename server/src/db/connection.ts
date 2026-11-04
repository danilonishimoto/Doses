import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(customPath?: string): Database.Database {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || path.resolve(process.cwd(), env.DATABASE_FILE);

  // Cria o diretório de dados caso não exista
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Configurações pragmáticas essenciais para alta confiabilidade e concorrência:
  // 1. Chaves estrangeiras ativas
  db.pragma('foreign_keys = ON');
  // 2. WAL mode: permite leituras e escritas concorrentes sem travar o arquivo
  db.pragma('journal_mode = WAL');
  // 3. synchronous = NORMAL: segurança sem o custo massivo de fsync excessivo
  db.pragma('synchronous = NORMAL');
  // 4. busy_timeout: aguarda até 5 segundos em caso de concorrência antes de falhar
  db.pragma('busy_timeout = 5000');

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
