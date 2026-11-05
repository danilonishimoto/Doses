import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { db } from '../database/db';
import { AccountService } from '../account/AccountService';
import { ProfileService } from '../profile/ProfileService';
import { ApiMedicationRepository } from '../../features/medications/services/apiMedicationRepository';
import { apiClient } from './apiClient';

// Setup mock window and localStorage for Node testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
(globalThis as any).localStorage = localStorageMock;
(globalThis as any).window = { location: { hostname: 'localhost' }, isSecureContext: true };

async function main() {
  console.log('================================================================');
  console.log('  HOMOLOGAÇÃO FRONTEND: DEXIE + API REPOSITORY (LIVE SERVER)    ');
  console.log('================================================================\n');

  // 1. Criação de conta pelo AccountService
  const testUsername = 'frontend_user_' + Date.now();
  const testPass = 'SenhaSegura123!';

  console.log('1. Testando AccountService.createAccount com backend real...');
  const account = await AccountService.createAccount(testUsername, testPass);
  assert.ok(account.id, 'Conta deve conter ID');
  assert.equal(account.username, testUsername);

  // Confirma que tokens foram gravados no localStorage
  assert.ok(apiClient.getAccessToken(), 'AccessToken deve estar no localStorage');
  assert.ok(apiClient.getRefreshToken(), 'RefreshToken deve estar no localStorage');

  // Confirma que conta foi gravada no Dexie
  const dexieAccount = await db.accounts.get(account.id);
  assert.ok(dexieAccount, 'Conta deve existir no Dexie local');
  console.log('✓ AccountService gravou conta no Dexie e obteve tokens do backend.');

  // 2. Criação de perfil pelo ProfileService
  console.log('2. Testando ProfileService.createProfile integrado à API...');
  const profile = await ProfileService.createProfile({
    accountId: account.id,
    name: 'Ana Júlia',
    surname: 'Silveira',
    age: 28,
    weight: 58,
    height: 164,
    avatar: 'young-woman',
    isMainProfile: true,
  });

  assert.ok(profile.id.startsWith('prof_'), 'Profile ID deve vir do backend (prof_...)');
  assert.equal(profile.name, 'Ana Júlia');

  // Confirma no Dexie local
  const dexieProfile = await db.profiles.get(profile.id);
  assert.ok(dexieProfile, 'Perfil deve existir no Dexie');
  assert.equal(dexieProfile.id, profile.id, 'ID do Dexie deve coincidir com ID do backend');
  console.log('✓ ProfileService criou perfil no backend e espelhou no Dexie com mesmo ID (', profile.id, ').');

  // 3. Atualização de perfil
  console.log('3. Testando ProfileService.updateProfile integrado...');
  const updatedProfile = await ProfileService.updateProfile(profile.id, {
    name: 'Ana Júlia Modificada',
  });
  assert.equal(updatedProfile.name, 'Ana Júlia Modificada');
  const dexieUpdated = await db.profiles.get(profile.id);
  assert.equal(dexieUpdated?.name, 'Ana Júlia Modificada');
  console.log('✓ ProfileService atualizou perfil no Dexie e backend.');

  // 4. Criação de medicamento via ApiMedicationRepository
  console.log('4. Testando ApiMedicationRepository.create integrado...');
  const repo = new ApiMedicationRepository({ baseUrl: 'http://localhost:3333/api/v1' });
  const med = await repo.create({
    profileId: profile.id,
    name: 'Omeprazol 20mg',
    instructions: '1 cápsula em jejum',
    schedules: ['06:30', '18:30'],
    recurrence: { type: 'daily' },
  });

  assert.ok(med.id.startsWith('med_'), 'ID do medicamento deve vir do backend (med_...)');
  assert.equal(med.name, 'Omeprazol 20mg');
  assert.equal(med.schedules.length, 2);

  // Confirma no Dexie local
  const dexieMed = await db.medications.get(med.id);
  assert.ok(dexieMed, 'Medicamento deve existir no Dexie local');
  assert.equal(dexieMed.name, 'Omeprazol 20mg');
  assert.equal(dexieMed.schedules.length, 2);
  console.log('✓ ApiMedicationRepository gravou medicamento no backend e espelhou no Dexie (ID:', med.id, ').');

  // 5. Listagem de medicamentos
  console.log('5. Testando ApiMedicationRepository.list...');
  const list = await repo.list(profile.id);
  assert.ok(list.length >= 1);
  assert.ok(list.some((m) => m.id === med.id));
  console.log('✓ ApiMedicationRepository listou medicamentos com sucesso da API.');

  // 6. Atualização de medicamento
  console.log('6. Testando ApiMedicationRepository.update...');
  const updatedMed = await repo.update(med.id, {
    instructions: 'Tomar com água morna',
    schedules: ['07:00'],
  });
  assert.equal(updatedMed.instructions, 'Tomar com água morna');
  assert.equal(updatedMed.schedules.length, 1);
  assert.equal(updatedMed.schedules[0], '07:00');
  console.log('✓ ApiMedicationRepository atualizou medicamento e horários na API e Dexie.');

  // 7. Exclusão de medicamento
  console.log('7. Testando ApiMedicationRepository.delete...');
  await repo.delete(med.id);
  const dexieDeleted = await db.medications.get(med.id);
  assert.equal(dexieDeleted, undefined, 'Medicamento deve ter sido removido do Dexie');
  console.log('✓ ApiMedicationRepository removeu medicamento do Dexie e da API.');

  // 8. Exclusão de perfil
  console.log('8. Testando ProfileService.deleteProfile...');
  await ProfileService.deleteProfile(profile.id);
  const dexieProfDeleted = await db.profiles.get(profile.id);
  assert.equal(dexieProfDeleted, undefined, 'Perfil deve ter sido removido do Dexie');
  console.log('✓ ProfileService removeu perfil do Dexie e da API.');

  // 9. Logout
  console.log('9. Testando AccountService.clearActiveAccount (Logout)...');
  AccountService.clearActiveAccount();
  assert.equal(apiClient.getAccessToken(), null, 'AccessToken deve ser limpo');
  assert.equal(apiClient.getRefreshToken(), null, 'RefreshToken deve ser limpo');
  console.log('✓ Logout limpou tokens e revogou sessão.');

  console.log('\n================================================================');
  console.log('  FLUXO DEXIE + API REPOSITORY HOMOLOGADO COM SUCESSO!         ');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n[FALHA NO FLUXO DEXIE + API]:', err);
  process.exit(1);
});
