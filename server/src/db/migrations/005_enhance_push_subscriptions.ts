import Database from 'better-sqlite3';

export const migration = {
  version: '005',
  name: 'enhance_push_subscriptions',
  up: (db: Database.Database) => {
    // 1. Inspeciona as colunas existentes para garantir idempotência
    const tableInfo = db.prepare("PRAGMA table_info('push_subscriptions')").all() as { name: string }[];
    const colNames = new Set(tableInfo.map((c) => c.name));

    // 2. Adiciona device_name se não existir (identificação amigável do dispositivo)
    if (!colNames.has('device_name')) {
      db.exec(`ALTER TABLE push_subscriptions ADD COLUMN device_name TEXT NOT NULL DEFAULT '';`);
    }

    // 3. Adiciona updated_at se não existir (registro de última alteração de estado/preferência)
    if (!colNames.has('updated_at')) {
      db.exec(`ALTER TABLE push_subscriptions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));`);
    }
  },
};
