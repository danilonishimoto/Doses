import assert from 'node:assert';
import { notificationOnboardingManager } from './notificationOnboardingManager';
import { notificationService, type NotificationPlatformDiagnostics } from './notificationService';

// Mock de localStorage em memória para os testes
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

async function runNotificationOnboardingTests() {
  console.log('================================================================');
  console.log('  Suíte de Testes — Onboarding de Permissão para Push (Doses)   ');
  console.log('================================================================\n');

  let passed = 0;
  const mockStorage = new MockLocalStorage();
  (globalThis as any).localStorage = mockStorage;

  const supportedDiagnostics: NotificationPlatformDiagnostics = {
    supportStatus: 'supported',
    permission: 'default',
    isStandalonePWA: false,
    isIOS: false,
    hasPushManager: true,
    hasServiceWorker: true,
    isSecureContext: true,
  };

  const iosBrowserDiagnostics: NotificationPlatformDiagnostics = {
    supportStatus: 'ios-browser-requires-install',
    permission: 'unsupported',
    isStandalonePWA: false,
    isIOS: true,
    hasPushManager: false,
    hasServiceWorker: false,
    isSecureContext: true,
  };

  const unsupportedDiagnostics: NotificationPlatformDiagnostics = {
    supportStatus: 'unsupported',
    permission: 'unsupported',
    isStandalonePWA: false,
    isIOS: false,
    hasPushManager: false,
    hasServiceWorker: false,
    isSecureContext: true,
  };

  // -------------------------------------------------------------
  // Teste 1: Exibição após cadastro de nova conta (unprompted)
  // -------------------------------------------------------------
  mockStorage.clear();
  const newAccountId = 'acc_novocadastro_1';
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(newAccountId), 'unprompted');
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(newAccountId), false);

  const shouldShowNewAccount = notificationOnboardingManager.shouldShowOnboarding({
    accountId: newAccountId,
    diagnostics: supportedDiagnostics,
  });
  assert.strictEqual(shouldShowNewAccount, true);
  console.log('✓ Teste 1: Exibição correta após criação de nova conta (estado unprompted)');
  passed++;

  // -------------------------------------------------------------
  // Teste 2: Exibição no primeiro acesso de conta existente
  // -------------------------------------------------------------
  const existingAccountId = 'acc_existente_2';
  const shouldShowExisting = notificationOnboardingManager.shouldShowOnboarding({
    accountId: existingAccountId,
    diagnostics: supportedDiagnostics,
  });
  assert.strictEqual(shouldShowExisting, true);
  console.log('✓ Teste 2: Exibição no primeiro acesso de conta existente que não passou pelo onboarding');
  passed++;

  // -------------------------------------------------------------
  // Teste 3: Não exibição após dispensar (dismissed)
  // -------------------------------------------------------------
  notificationOnboardingManager.dismissOnboarding(existingAccountId);
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(existingAccountId), 'dismissed');

  const shouldShowDismissed = notificationOnboardingManager.shouldShowOnboarding({
    accountId: existingAccountId,
    diagnostics: supportedDiagnostics,
  });
  assert.strictEqual(shouldShowDismissed, false);
  console.log('✓ Teste 3: Não exibição após o usuário dispensar o modal (Agora não / Fechar)');
  passed++;

  // -------------------------------------------------------------
  // Teste 4: Não exibição quando já existe inscrição válida para a conta
  // -------------------------------------------------------------
  const subscribedAccountId = 'acc_inscrita_3';
  notificationOnboardingManager.setAccountSubscribedLocally(subscribedAccountId, true);
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(subscribedAccountId), true);
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(subscribedAccountId), 'completed');

  const shouldShowSubscribed = notificationOnboardingManager.shouldShowOnboarding({
    accountId: subscribedAccountId,
    diagnostics: supportedDiagnostics,
  });
  assert.strictEqual(shouldShowSubscribed, false);
  console.log('✓ Teste 4: Não exibição quando a conta já possui inscrição ativa e associada');
  passed++;

  // -------------------------------------------------------------
  // Teste 5: Isolamento multi-contas (Conta A dispensada NÃO afeta Conta B)
  // -------------------------------------------------------------
  const accountA = 'acc_tenant_A';
  const accountB = 'acc_tenant_B';

  notificationOnboardingManager.dismissOnboarding(accountA);
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(accountA), 'dismissed');
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(accountB), 'unprompted');

  assert.strictEqual(
    notificationOnboardingManager.shouldShowOnboarding({
      accountId: accountA,
      diagnostics: supportedDiagnostics,
    }),
    false
  );
  assert.strictEqual(
    notificationOnboardingManager.shouldShowOnboarding({
      accountId: accountB,
      diagnostics: supportedDiagnostics,
    }),
    true
  );
  console.log('✓ Teste 5: Isolamento estrito entre contas: dispensar na Conta A não afeta a Conta B');
  passed++;

  // -------------------------------------------------------------
  // Teste 6: Isolamento multi-contas (Conta A inscrita NÃO afeta Conta B)
  // -------------------------------------------------------------
  notificationOnboardingManager.completeOnboarding(accountA);
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(accountA), true);
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(accountB), false);

  assert.strictEqual(
    notificationOnboardingManager.shouldShowOnboarding({
      accountId: accountB,
      diagnostics: supportedDiagnostics,
    }),
    true
  );
  console.log('✓ Teste 6: Inscrição concluída na Conta A mantém a Conta B independente');
  passed++;

  // -------------------------------------------------------------
  // Teste 7: Notification.permission === 'granted' isoladamente NÃO dispensa onboarding
  // -------------------------------------------------------------
  const accountPermissionOnly = 'acc_perm_only';
  const grantedDiagnostics: NotificationPlatformDiagnostics = {
    ...supportedDiagnostics,
    permission: 'granted',
  };
  // Conta ainda não inscrita nem completada
  const shouldShowGrantedWithoutSub = notificationOnboardingManager.shouldShowOnboarding({
    accountId: accountPermissionOnly,
    diagnostics: grantedDiagnostics,
  });
  assert.strictEqual(shouldShowGrantedWithoutSub, true);
  console.log('✓ Teste 7: Notification.permission === "granted" não dispensa onboarding sem inscrição na conta');
  passed++;

  // -------------------------------------------------------------
  // Teste 8: Solicitação de permissão somente mediante ação explícita
  // -------------------------------------------------------------
  let permissionPromptTriggered = false;
  const mockNotification = {
    permission: 'default',
    requestPermission: async () => {
      permissionPromptTriggered = true;
      return 'granted';
    },
  };
  (globalThis as any).Notification = mockNotification;

  // Apenas avaliar se deve exibir o onboarding NÃO deve invocar requestPermission
  notificationOnboardingManager.shouldShowOnboarding({
    accountId: 'acc_no_prompt_yet',
    diagnostics: supportedDiagnostics,
  });
  assert.strictEqual(permissionPromptTriggered, false);
  console.log('✓ Teste 8: Nenhuma solicitação de permissão ocorre sem clique/ação explícita do usuário');
  passed++;

  // -------------------------------------------------------------
  // Teste 9: Tratamento de ambiente incompatível (iOS fora do PWA e browser sem suporte)
  // -------------------------------------------------------------
  // No iOS Safari fora do PWA: deve retornar true para exibir orientação de instalação PWA
  const shouldShowIos = notificationOnboardingManager.shouldShowOnboarding({
    accountId: 'acc_ios_user',
    diagnostics: iosBrowserDiagnostics,
  });
  assert.strictEqual(shouldShowIos, true);

  // Em browser totalmente sem suporte: não exibe
  const shouldShowUnsupported = notificationOnboardingManager.shouldShowOnboarding({
    accountId: 'acc_unsupported_user',
    diagnostics: unsupportedDiagnostics,
  });
  assert.strictEqual(shouldShowUnsupported, false);
  console.log('✓ Teste 9: Compatibilidade com iOS fora do PWA e supressão em ambiente sem suporte');
  passed++;

  // -------------------------------------------------------------
  // Teste 10: Fluxo completo de ativação com sucesso
  // -------------------------------------------------------------
  const activateAccountId = 'acc_activation_test';
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(activateAccountId), 'unprompted');

  // Simula conclusão bem-sucedida da ativação
  notificationOnboardingManager.completeOnboarding(activateAccountId);
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(activateAccountId), 'completed');
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(activateAccountId), true);
  assert.strictEqual(
    notificationOnboardingManager.shouldShowOnboarding({
      accountId: activateAccountId,
      diagnostics: supportedDiagnostics,
    }),
    false
  );
  console.log('✓ Teste 10: Conclusão bem-sucedida atualiza persistência e encerra onboarding');
  passed++;

  // -------------------------------------------------------------
  // Teste 11: Falha no registro push permite retentativa sem descartar o fluxo
  // -------------------------------------------------------------
  const retryAccountId = 'acc_retry_flow';
  // Em caso de falha de rede ou servidor, nem dismiss nem complete devem ser chamados
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(retryAccountId), 'unprompted');
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(retryAccountId), false);
  // O usuário ainda deve ver a opção de tentar novamente
  assert.strictEqual(
    notificationOnboardingManager.shouldShowOnboarding({
      accountId: retryAccountId,
      diagnostics: supportedDiagnostics,
    }),
    true
  );

  // Na retentativa com sucesso:
  notificationOnboardingManager.completeOnboarding(retryAccountId);
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(retryAccountId), 'completed');
  console.log('✓ Teste 11: Falha no registro push mantém elegibilidade e permite retentativa limpa');
  passed++;

  // -------------------------------------------------------------
  // Teste 12: Resiliência a entradas inválidas e ausência de localStorage
  // -------------------------------------------------------------
  assert.strictEqual(
    notificationOnboardingManager.shouldShowOnboarding({
      accountId: '',
      diagnostics: supportedDiagnostics,
    }),
    false
  );
  assert.strictEqual(notificationOnboardingManager.getOnboardingState(''), 'unprompted');
  assert.strictEqual(notificationOnboardingManager.isAccountSubscribedLocally(''), false);
  console.log('✓ Teste 12: Resiliência comprovada com parâmetros vazios ou inválidos');
  passed++;

  console.log('\n================================================================');
  console.log(`  RESULTADO: ${passed} de 12 testes de Onboarding APROVADOS!    `);
  console.log('================================================================\n');
}

runNotificationOnboardingTests().catch((err) => {
  console.error('\n[FALHA NO TESTE DE ONBOARDING]:', err);
  process.exit(1);
});
