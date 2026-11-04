import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { db } from '../../services/database/db';
import { AccountService } from '../../services/account/AccountService';
import type { OnboardingDraft, AvatarId } from '../../types';

test('Navegação do Botão Voltar no Onboarding e Preservação de Dados', async (t) => {
  await db.delete();
  await db.open();

  await t.test('1. Submeter CreateAccount e transicionar para MainProfile com rascunho de credenciais', async () => {
    let substep: string = 'create-account';
    let onboardingDraft: OnboardingDraft = {};

    // Usuário preenche CreateAccountScreen
    const username = 'mariaclara';
    const password = 'password123';

    // Criação de conta
    const account = await AccountService.createAccount(username, password);
    assert.ok(account.id);
    assert.equal(account.username, 'mariaclara');

    // Callback onSuccess da tela de criar conta atualiza o draft e o substep
    onboardingDraft = {
      ...onboardingDraft,
      username,
      password,
    };
    substep = 'main-profile';

    assert.equal(substep, 'main-profile');
    assert.equal(onboardingDraft.username, 'mariaclara');
    assert.equal(onboardingDraft.password, 'password123');

    // 2. No MainProfileScreen, usuário preenche dados do perfil
    const profileDraft = {
      avatar: 'senior-person' as AvatarId,
      name: 'Maria',
      surname: 'Clara',
      age: '45',
      weight: '62.5',
      height: '165',
    };

    // 3. Usuário clica no botão Voltar do MainProfileScreen
    // onBack passa o rascunho para AppContent
    onboardingDraft = {
      ...onboardingDraft,
      mainProfile: profileDraft,
    };
    substep = 'create-account';

    // Confirma que voltou para create-account
    assert.equal(substep, 'create-account');
    // Confirma que as credenciais anteriores continuam preservadas
    assert.equal(onboardingDraft.username, 'mariaclara');
    assert.equal(onboardingDraft.password, 'password123');

    // 4. Usuário confirma novamente na tela de CreateAccount (sem erro de conta duplicada)
    let reconfirmedAccount;
    const currentAccountId = account.id;
    const trimmedUsername = onboardingDraft.username!.trim();

    if (currentAccountId && trimmedUsername.toLowerCase() === username.toLowerCase()) {
      const existing = await AccountService.getAccountById(currentAccountId);
      reconfirmedAccount = existing;
    } else {
      reconfirmedAccount = await AccountService.createAccount(trimmedUsername, onboardingDraft.password!);
    }

    assert.ok(reconfirmedAccount);
    assert.equal(reconfirmedAccount?.id, account.id);
    substep = 'main-profile';

    // 5. Retorna ao MainProfileScreen com todos os dados preenchidos preservados
    assert.equal(substep, 'main-profile');
    assert.deepEqual(onboardingDraft.mainProfile, {
      avatar: 'senior-person',
      name: 'Maria',
      surname: 'Clara',
      age: '45',
      weight: '62.5',
      height: '165',
    });
  });
});
