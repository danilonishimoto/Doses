import Database from 'better-sqlite3';

export const migration = {
  version: '003',
  name: 'add_lease_token_to_occurrences',
  up: (db: Database.Database) => {
    // Adiciona coluna lease_token para garantir que apenas o worker detentor
    // da reserva ativa atual possa concluir ou transitar o estado da ocorrência.
    db.exec(`
      ALTER TABLE dose_occurrences ADD COLUMN lease_token TEXT;
    `);
  },
};
