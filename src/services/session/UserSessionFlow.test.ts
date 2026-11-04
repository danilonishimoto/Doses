import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { db } from '../database/db';
import { AccountService } from '../account/AccountService';
import { ProfileService } from '../profile/ProfileService';
import type { Account, Profile } from '../../types';

test('Fluxo de Entrada e Saída de Usuários — Doses (Sessão vs Cadastro)', async (t) => {
  await db.delete();
  await db.open();

  // Estados em memória que espelham useApp e AppContent
  let currentAccount: Account | null = null;
  let activeProfile: Profile | null = null;
  let profiles: Profile[] = [];
  let onboardingSubstep: string | null = null;

  // Helpers que reproduzem o ciclo de vida do useApp
  const loadInitial = async () => {
    const activeAccountId = AccountService.getActiveAccountId();
    let account: Account | undefined;
    if (activeAccountId) {
      account = await AccountService.getAccountById(activeAccountId);
    }
    if (!account) {
      account = await AccountService.getFirstAccount();
      if (account) AccountService.setActiveAccountId(account.id);
    }

    if (account) {
      currentAccount = account;
      profiles = await ProfileService.getProfilesByAccount(account.id);
      // Sessão ativa não é restaurada no reload/reopen
      activeProfile = null;
      ProfileService.clearActiveProfileId();
    } else {
      currentAccount = null;
      profiles = [];
      activeProfile = null;
    }
  };

  const determineVisibleScreen = () => {
    if (!currentAccount) return 'CreateAccountScreen';
    if (profiles.length === 0) return 'MainProfileScreen';
    if (onboardingSubstep === 'profile-selection') return 'ProfileSelectionScreen';
    if (onboardingSubstep === 'add-person') return 'AddPersonScreen';
    if (onboardingSubstep === 'updated-profiles') return 'UpdatedProfilesScreen';
    if (activeProfile) return 'AppHomeScreen';
    return 'ProfileSelectionEntryScreen'; // Tela "Entrar"
  };

  const selectActiveProfile = async (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    if (!target) return false;
    activeProfile = target;
    ProfileService.setActiveProfileId(target.id);
    return true;
  };

  const logout = () => {
    // Encerra apenas a sessão ativa, sem excluir cadastro e perfis
    ProfileService.clearActiveProfileId();
    activeProfile = null;
  };

  await t.test('1. Primeiro acesso: Sem cadastro, exibe tela de criação de conta', async () => {
    await loadInitial();
    assert.equal(currentAccount, null);
    assert.equal(profiles.length, 0);
    assert.equal(activeProfile, null);
    assert.equal(determineVisibleScreen(), 'CreateAccountScreen');
  });

  let mainProfile: Profile;
  let secondProfile: Profile;

  await t.test('2. Cadastro concluído: Cria conta, perfis e entra na aplicação imediatamente', async () => {
    // 2.1 Cria conta
    const account = await AccountService.createAccount('mariaclara', 'senha@123');
    currentAccount = account;
    AccountService.setActiveAccountId(account.id);

    // 2.2 Cria perfil principal
    mainProfile = await ProfileService.createProfile({
      accountId: account.id,
      name: 'Maria Clara',
      surname: 'Mendes',
      age: 38,
      weight: 62,
      height: 167,
      avatar: 'young-woman',
      isMainProfile: true,
    });

    // 2.3 Cria segundo perfil
    secondProfile = await ProfileService.createProfile({
      accountId: account.id,
      name: 'Seu José',
      surname: 'Mendes',
      age: 72,
      weight: 70,
      height: 170,
      avatar: 'senior-person',
      isMainProfile: false,
    });

    profiles = await ProfileService.getProfilesByAccount(account.id);
    assert.equal(profiles.length, 2);

    // 2.4 Ao concluir cadastro, ativa o perfil principal e abre a aplicação
    await selectActiveProfile(mainProfile.id);
    assert.ok(activeProfile);
    assert.equal(activeProfile.name, 'Maria Clara');
    assert.equal(determineVisibleScreen(), 'AppHomeScreen');
  });

  await t.test('3. Recarregar / Fechar e reabrir aplicação: Não mantém sessão ativa e exibe tela "Entrar"', async () => {
    // Simula reload da SPA (reset de variáveis de memória e execução de loadInitial)
    currentAccount = null;
    activeProfile = null;
    profiles = [];

    await loadInitial();

    // Conta e perfis persistem no IndexedDB
    assert.ok(currentAccount, 'Conta continua persistida no storage');
    assert.equal(profiles.length, 2, 'Dois perfis continuam persistidos');
    // Sessão ativa não existe
    assert.equal(activeProfile, null, 'Sessão ativa encerrada no reload/reopen');

    // A tela exibida é obrigatoriamente a tela "Entrar"
    assert.equal(determineVisibleScreen(), 'ProfileSelectionEntryScreen');
  });

  await t.test('4. Tela Entrar: Exibe os perfis cadastrados para escolha', () => {
    assert.equal(determineVisibleScreen(), 'ProfileSelectionEntryScreen');
    assert.equal(profiles.length, 2);
    assert.equal(profiles[0].name, 'Maria Clara');
    assert.equal(profiles[1].name, 'Seu José');
  });

  await t.test('5. Selecionar perfil: Abre a aplicação com o perfil escolhido', async () => {
    const success = await selectActiveProfile(profiles[0].id);
    assert.equal(success, true);
    assert.ok(activeProfile);
    assert.equal(activeProfile.id, profiles[0].id);
    assert.equal(activeProfile.name, 'Maria Clara');
    assert.equal(determineVisibleScreen(), 'AppHomeScreen');
  });

  await t.test('6. Clicar em Sair: Encerra sessão ativa e retorna para tela "Entrar"', () => {
    logout();
    assert.equal(activeProfile, null, 'activeProfile deve ser nulo após sair');
    assert.equal(determineVisibleScreen(), 'ProfileSelectionEntryScreen');
  });

  await t.test('7. Sair e selecionar outro perfil: Permite acessar com outro perfil', async () => {
    assert.equal(determineVisibleScreen(), 'ProfileSelectionEntryScreen');
    const success = await selectActiveProfile(secondProfile.id);
    assert.equal(success, true);
    assert.ok(activeProfile);
    assert.equal(activeProfile.id, secondProfile.id);
    assert.equal(activeProfile.name, 'Seu José');
    assert.equal(determineVisibleScreen(), 'AppHomeScreen');
  });

  await t.test('8. Logout / Saída: Não exclui nem redefine os dados cadastrados', async () => {
    logout();
    assert.equal(activeProfile, null);

    // Consulta direta no IndexedDB
    const dbProfiles = await ProfileService.getProfilesByAccount(currentAccount!.id);
    assert.equal(dbProfiles.length, 2, 'Todos os perfis permanecem intactos no IndexedDB');
    const dbAccount = await AccountService.getAccountById(currentAccount!.id);
    assert.ok(dbAccount, 'A conta permanece intacta no IndexedDB');
  });

  await t.test('9. Recarregar a aplicação após estar logado: Não mantém a sessão ativa', async () => {
    // Entra novamente com Seu José
    await selectActiveProfile(secondProfile.id);
    assert.equal(determineVisibleScreen(), 'AppHomeScreen');

    // Usuário recarrega a página (F5 / Reload)
    await loadInitial();
    assert.equal(activeProfile, null, 'Sessão ativa é encerrada ao recarregar');
    assert.equal(determineVisibleScreen(), 'ProfileSelectionEntryScreen');
  });
});
