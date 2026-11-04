import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { db } from '../database/db';
import { AccountService } from './AccountService';
import { ProfileService } from '../profile/ProfileService';
import type { Account, Profile } from '../../types';

// Mock localStorage in Node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as unknown as { localStorage: typeof localStorageMock }).localStorage = localStorageMock;

test('Fluxo Completo de Criação de Conta, Perfil e Abertura do Doses', async (t) => {
  // Reset banco e localStorage
  await db.accounts.clear();
  await db.profiles.clear();
  localStorage.clear();

  let currentAccount: Account | null = null;
  let activeProfile: Profile | null = null;
  let profiles: Profile[] = [];

  // Implementação fiel da lógica de useApp para teste de fluxo integrado
  const loginAccount = async (account: Account) => {
    AccountService.setActiveAccountId(account.id);
    currentAccount = account;
    profiles = await ProfileService.getProfilesByAccount(account.id);
    const activeId = ProfileService.getActiveProfileId();
    if (activeId) {
      const found = profiles.find((p) => p.id === activeId);
      activeProfile = found || null;
    } else {
      activeProfile = null;
    }
  };

  const refreshProfiles = async (): Promise<Profile[]> => {
    let account = currentAccount;
    if (!account) {
      const activeId = AccountService.getActiveAccountId();
      if (activeId) {
        account = (await AccountService.getAccountById(activeId)) || null;
        if (account) currentAccount = account;
      }
    }
    if (!account) return [];
    profiles = await ProfileService.getProfilesByAccount(account.id);
    const activeId = ProfileService.getActiveProfileId();
    if (activeId) {
      const found = profiles.find((p) => p.id === activeId);
      activeProfile = found || null;
    }
    return profiles;
  };

  const selectActiveProfile = async (profileId: string): Promise<boolean> => {
    let account = currentAccount;
    if (!account) {
      const activeId = AccountService.getActiveAccountId();
      if (activeId) {
        account = (await AccountService.getAccountById(activeId)) || null;
        if (account) currentAccount = account;
      }
    }
    if (!account) return false;

    let target = profiles.find((p) => p.id === profileId);
    if (!target) {
      target = await ProfileService.getProfileById(profileId);
    }
    if (!target || target.accountId !== account.id) {
      return false;
    }

    ProfileService.setActiveProfileId(target.id);
    activeProfile = target;
    return true;
  };

  await t.test('1. Estado inicial sem conta deve exigir criação de conta', () => {
    assert.equal(currentAccount, null, 'Nenhuma conta deve existir no início');
    assert.equal(profiles.length, 0, 'Nenhum perfil deve existir');
    assert.equal(activeProfile, null, 'Nenhum perfil ativo');
  });

  await t.test('2. Criação de conta persiste no IndexedDB e atualiza sessão com loginAccount', async () => {
    const createdAccount = await AccountService.createAccount('danillo_test', 'senha123');
    assert.ok(createdAccount.id, 'Conta criada deve conter id');
    assert.equal(createdAccount.username, 'danillo_test');

    // Simula a chamada corrigida do AppContent
    await loginAccount(createdAccount);

    assert.ok(currentAccount, 'currentAccount deve estar preenchido na sessão');
    assert.equal(currentAccount?.id, createdAccount.id);
    assert.equal(AccountService.getActiveAccountId(), createdAccount.id, 'ActiveAccountId deve estar no localStorage');
  });

  await t.test('3. Com conta autenticada mas sem perfil, transiciona para criação de perfil principal', async () => {
    assert.ok(currentAccount, 'Conta autenticada');
    assert.equal(profiles.length, 0, 'Ainda sem perfis, deve disparar MainProfileScreen');

    const mainProfile = await ProfileService.createProfile({
      accountId: currentAccount!.id,
      name: 'Danillo',
      surname: 'Silva',
      age: 32,
      weight: 78.5,
      height: 180,
      avatar: 'young-woman',
      isMainProfile: true,
    });

    assert.ok(mainProfile.id, 'Perfil principal deve ter ID');
    assert.equal(mainProfile.isMainProfile, true);

    // Atualiza perfis
    await refreshProfiles();
    assert.equal(profiles.length, 1, 'profiles agora contém 1 perfil');
    assert.equal(profiles[0].name, 'Danillo');
  });

  await t.test('4. Conclusão do onboarding seleciona o perfil e abre a aplicação', async () => {
    // Com 1 perfil cadastrado, a conclusão seleciona o perfil principal
    const success = await selectActiveProfile(profiles[0].id);
    assert.equal(success, true, 'Seleção de perfil deve ter sucesso');
    assert.ok(activeProfile, 'activeProfile deve estar definido');
    assert.equal(activeProfile?.name, 'Danillo');
    assert.equal(ProfileService.getActiveProfileId(), profiles[0].id, 'ActiveProfileId deve estar persistido');
  });

  await t.test('5. Fechar e reabrir o PWA (reload/restore) restaura conta e perfil ativo automaticamente', async () => {
    // Simula reset de memória da SPA (como fechar o app e reabrir)
    currentAccount = null;
    activeProfile = null;
    profiles = [];

    // Lógica de loadInitial executada no mount do AppProvider
    const activeAccountId = AccountService.getActiveAccountId();
    assert.ok(activeAccountId, 'AccountId deve ser recuperado do storage');

    const restoredAccount = await AccountService.getAccountById(activeAccountId!);
    assert.ok(restoredAccount, 'Conta deve ser encontrada no IndexedDB');
    currentAccount = restoredAccount!;

    profiles = await ProfileService.getProfilesByAccount(restoredAccount!.id);
    assert.equal(profiles.length, 1, 'Perfis da conta restaurados com sucesso');

    const savedProfileId = ProfileService.getActiveProfileId();
    assert.ok(savedProfileId, 'ProfileId ativo recuperado');
    const matchedProfile = profiles.find((p) => p.id === savedProfileId);
    assert.ok(matchedProfile, 'Perfil ativo encontrado na lista');
    activeProfile = matchedProfile!;

    assert.equal(currentAccount.username, 'danillo_test');
    assert.equal(activeProfile.name, 'Danillo');
    assert.equal(activeProfile.isMainProfile, true);
  });

  await t.test('6. Adição de pessoa secundária e alternância entre perfis', async () => {
    // Adiciona uma pessoa idosa sob cuidados
    const person = await ProfileService.createProfile({
      accountId: currentAccount!.id,
      name: 'José',
      surname: 'Silva',
      age: 72,
      weight: 68,
      height: 165,
      avatar: 'senior',
      isMainProfile: false,
    });

    await refreshProfiles();
    assert.equal(profiles.length, 2, 'Agora existem 2 perfis');

    // Alterna para José
    await selectActiveProfile(person.id);
    assert.equal(activeProfile?.id, person.id);
    assert.equal(activeProfile?.name, 'José');
    assert.equal(ProfileService.getActiveProfileId(), person.id);

    // Alterna de volta para Danillo
    const main = profiles.find((p) => p.isMainProfile)!;
    await selectActiveProfile(main.id);
    assert.equal(activeProfile?.id, main.id);
    assert.equal(activeProfile?.name, 'Danillo');
    assert.equal(ProfileService.getActiveProfileId(), main.id);
  });
});
