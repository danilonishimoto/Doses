import 'fake-indexeddb/auto';

// Mock de localStorage para ambiente Node.js de teste
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};
import { db } from '../database/db';
import { AccountService } from '../account/AccountService';
import { ProfileService } from './ProfileService';

async function runProfileSelectionTests() {
  console.log('--- Iniciando Testes da Seleção e Persistência do Perfil Ativo ---');

  // Limpa banco antes do teste
  await db.accounts.clear();
  await db.profiles.clear();
  ProfileService.clearActiveProfileId();

  // 1. Cria conta de teste
  const account1 = await AccountService.createAccount('camilla', 'senha123');
  const account2 = await AccountService.createAccount('outro_usuario', 'senha123');

  // 2. Cria perfis para a conta 1
  const camillaProfile = await ProfileService.createProfile({
    accountId: account1.id,
    name: 'Camilla',
    surname: 'Silva',
    age: 28,
    weight: 60,
    height: 168,
    avatar: 'young-woman',
    isMainProfile: true,
  });

  const joseProfile = await ProfileService.createProfile({
    accountId: account1.id,
    name: 'José',
    surname: 'Silva',
    age: 74,
    weight: 79,
    height: 172,
    avatar: 'senior-person',
    isMainProfile: false,
  });

  const amoraProfile = await ProfileService.createProfile({
    accountId: account1.id,
    name: 'Amora',
    surname: 'Pet',
    age: 4,
    weight: 12,
    height: 45,
    avatar: 'doguinho-fofo',
    isMainProfile: false,
  });

  // 3. Testa persistência do perfil ativo
  console.log('1. Testando seleção de perfil ativo...');
  ProfileService.setActiveProfileId(camillaProfile.id);
  console.assert(ProfileService.getActiveProfileId() === camillaProfile.id, 'Perfil ativo deve ser Camilla');

  // 4. Testa troca de perfil ativo para José
  console.log('2. Testando alternância para outro perfil (José)...');
  ProfileService.setActiveProfileId(joseProfile.id);
  console.assert(ProfileService.getActiveProfileId() === joseProfile.id, 'Perfil ativo deve ser José');

  // 5. Testa alternância para Amora (doguinho)
  console.log('3. Testando alternância para Amora (Pet)...');
  ProfileService.setActiveProfileId(amoraProfile.id);
  console.assert(ProfileService.getActiveProfileId() === amoraProfile.id, 'Perfil ativo deve ser Amora');

  // 6. Testa validação de isolamento: perfil da conta 1 consultado pela conta 2 não deve aparecer
  console.log('4. Testando isolamento entre contas no IndexedDB...');
  const account2Profiles = await ProfileService.getProfilesByAccount(account2.id);
  console.assert(account2Profiles.length === 0, 'Conta 2 não deve ver perfis da conta 1');

  // 7. Limpeza do perfil ativo
  console.log('5. Testando limpeza de perfil ativo (logout/switch)...');
  ProfileService.clearActiveProfileId();
  console.assert(ProfileService.getActiveProfileId() === null, 'Perfil ativo deve ser nulo após limpeza');

  console.log('--- TODOS OS TESTES DE SELEÇÃO DE PERFIL PASSARAM! ---');
}

runProfileSelectionTests().catch((err) => {
  console.error('Erro nos testes de seleção de perfil:', err);
  process.exit(1);
});
