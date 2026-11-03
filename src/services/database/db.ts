import Dexie, { type Table } from 'dexie';
import type { Account, Profile } from '../../types';

export class DosesDatabase extends Dexie {
  accounts!: Table<Account, string>;
  profiles!: Table<Profile, string>;

  constructor() {
    super('DosesAppDB');
    this.version(1).stores({
      accounts: 'id, &username, createdAt',
      profiles: 'id, accountId, isMainProfile, name, createdAt',
    });
  }
}

export const db = new DosesDatabase();
