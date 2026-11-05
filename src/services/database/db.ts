import Dexie, { type Table } from 'dexie';
import type { Account, Profile } from '../../types';
import type { Medication } from '../../features/medications/types/medication';

export class DosesDatabase extends Dexie {
  accounts!: Table<Account, string>;
  profiles!: Table<Profile, string>;
  medications!: Table<Medication, string>;

  constructor() {
    super('DosesAppDB');
    this.version(1).stores({
      accounts: 'id, &username, createdAt',
      profiles: 'id, accountId, isMainProfile, name, createdAt',
    });
    this.version(2).stores({
      accounts: 'id, &username, createdAt',
      profiles: 'id, accountId, isMainProfile, name, createdAt',
      medications: 'id, profileId, status, createdAt',
    });
  }
}

export const db = new DosesDatabase();
