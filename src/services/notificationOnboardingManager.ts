import type { NotificationPlatformDiagnostics } from './notificationService';

export type NotificationOnboardingPresentation = 'unprompted' | 'dismissed' | 'completed';

export interface ShouldShowOnboardingParams {
  accountId: string;
  diagnostics: NotificationPlatformDiagnostics;
  isSubscribedForAccount?: boolean;
}

const ONBOARDING_STATE_PREFIX = 'doses_notif_onboarding_state_';
const ACCOUNT_SUBSCRIBED_PREFIX = 'doses_notif_account_subscribed_';

export const notificationOnboardingManager = {
  /**
   * Obtém a chave do localStorage para o estado do onboarding da conta.
   */
  getStateKey(accountId: string): string {
    return `${ONBOARDING_STATE_PREFIX}${accountId}`;
  },

  /**
   * Obtém a chave do localStorage para o registro de push da conta.
   */
  getSubscribedKey(accountId: string): string {
    return `${ACCOUNT_SUBSCRIBED_PREFIX}${accountId}`;
  },

  /**
   * Retorna o estado atual do onboarding para a conta informada.
   */
  getOnboardingState(accountId: string): NotificationOnboardingPresentation {
    if (!accountId || typeof localStorage === 'undefined') {
      return 'unprompted';
    }

    try {
      const stored = localStorage.getItem(this.getStateKey(accountId));
      if (stored === 'dismissed' || stored === 'completed') {
        return stored;
      }
      return 'unprompted';
    } catch {
      return 'unprompted';
    }
  },

  /**
   * Define o estado de onboarding para uma conta específica.
   */
  setOnboardingState(accountId: string, state: NotificationOnboardingPresentation): void {
    if (!accountId || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.getStateKey(accountId), state);
    } catch (err) {
      console.warn('Falha ao salvar estado de onboarding de notificações:', err);
    }
  },

  /**
   * Verifica se a conta já possui uma inscrição push ativa e confirmada localmente.
   */
  isAccountSubscribedLocally(accountId: string): boolean {
    if (!accountId || typeof localStorage === 'undefined') return false;

    try {
      return localStorage.getItem(this.getSubscribedKey(accountId)) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Marca o status de inscrição push local para a conta.
   */
  setAccountSubscribedLocally(accountId: string, subscribed: boolean): void {
    if (!accountId || typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.getSubscribedKey(accountId), subscribed ? 'true' : 'false');
      if (subscribed) {
        this.setOnboardingState(accountId, 'completed');
      }
    } catch (err) {
      console.warn('Falha ao salvar status de inscrição da conta:', err);
    }
  },

  /**
   * Marca o onboarding como dispensado para a conta informada.
   */
  dismissOnboarding(accountId: string): void {
    this.setOnboardingState(accountId, 'dismissed');
  },

  /**
   * Marca o onboarding como concluído para a conta informada.
   */
  completeOnboarding(accountId: string): void {
    this.setOnboardingState(accountId, 'completed');
    this.setAccountSubscribedLocally(accountId, true);
  },

  /**
   * Reseta os registros de onboarding para a conta (útil para testes e depuração).
   */
  resetOnboardingForAccount(accountId: string): void {
    if (!accountId || typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(this.getStateKey(accountId));
      localStorage.removeItem(this.getSubscribedKey(accountId));
    } catch {}
  },

  /**
   * Determina se o pop-up de onboarding deve ser exibido para a conta atual.
   * 
   * Regras:
   * 1. Requer accountId válido.
   * 2. Se já foi dispensado ou completado, não exibe.
   * 3. Se a conta já possui inscrição ativa associada, não exibe.
   * 4. Se a plataforma for totalmente não suportada (sem Web Push e não é iOS), não exibe.
   * 5. No iOS fora do PWA, exibe para apresentar orientações de instalação.
   * 6. Notification.permission === 'granted' isoladamente NÃO dispensa se a conta não estiver inscrita.
   */
  shouldShowOnboarding({
    accountId,
    diagnostics,
    isSubscribedForAccount,
  }: ShouldShowOnboardingParams): boolean {
    if (!accountId) return false;

    // Se já foi dispensado ou completado para esta conta específica, não exibe
    const state = this.getOnboardingState(accountId);
    if (state === 'dismissed' || state === 'completed') {
      return false;
    }

    // Se a conta já possui inscrição ativa localmente, não exibe
    const subscribed = isSubscribedForAccount ?? this.isAccountSubscribedLocally(accountId);
    if (subscribed) {
      return false;
    }

    // Se o ambiente é totalmente sem suporte a notificações (e não é iOS com possibilidade de PWA), não exibe
    if (diagnostics.supportStatus === 'unsupported') {
      return false;
    }

    // Se for contexto inseguro (HTTP não-localhost), não é possível utilizar Web Push
    if (diagnostics.supportStatus === 'insecure-context') {
      return false;
    }

    // Em todos os outros casos (unprompted, suportado ou ios-browser-requires-install), exibe
    return true;
  },
};
