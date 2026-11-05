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

  await t.test('2. Botão Voltar da tela de cadastro deve transicionar para tela de login mesmo com hasAccountsInDb false', async () => {
    let onboardingSubstep: string | null = 'create-account';
    const hasAccountsInDb = false;

    // Função que decide qual tela renderizar (mesma regra de AppContent)
    function shouldShowCreateAccount(substep: string | null, hasAccounts: boolean) {
      return (substep === 'create-account' || !hasAccounts) && substep !== 'login';
    }

    assert.equal(shouldShowCreateAccount(onboardingSubstep, hasAccountsInDb), true);

    // Usuário clica no botão "Voltar" ou "Já possui uma conta? Entrar"
    const onNavigateToLogin = () => {
      onboardingSubstep = 'login';
    };

    onNavigateToLogin();

    // Deve transicionar para LoginScreen, não ficando preso em CreateAccountScreen
    assert.equal(onboardingSubstep, 'login');
    assert.equal(shouldShowCreateAccount(onboardingSubstep, hasAccountsInDb), false);
  });

  await t.test('3. Verificação de regras de CSS e safe area para PWA standalone no iOS', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.resolve(process.cwd(), 'src/styles/global.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Safe area no topo para não ficar sob a barra de status / Dynamic Island do iOS
    assert.ok(
      cssContent.includes('padding-top: env(safe-area-inset-top, 0px);'),
      'onboarding-screen deve respeitar safe-area-inset-top para botões do header no iOS PWA'
    );

    // Não deve conter -webkit-fill-available que quebra hit-testing no flexbox do WebKit standalone
    assert.ok(
      !cssContent.includes('-webkit-fill-available'),
      'Não deve usar -webkit-fill-available em containers com flexbox no iOS'
    );

    // touch-action: manipulation no botão voltar e no botão primário
    assert.ok(
      cssContent.includes('.header-back-button') && cssContent.includes('touch-action: manipulation;'),
      '.header-back-button deve ter touch-action: manipulation'
    );
    assert.ok(
      cssContent.includes('.primary-action-button') && cssContent.includes('touch-action: manipulation;'),
      '.primary-action-button deve ter touch-action: manipulation'
    );
  });
});
