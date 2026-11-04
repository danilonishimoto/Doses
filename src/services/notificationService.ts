export type NotificationSupportStatus =
  | 'supported'
  | 'unsupported'
  | 'ios-browser-requires-install';

export interface NotificationPlatformDiagnostics {
  supportStatus: NotificationSupportStatus;
  permission: NotificationPermission | 'unsupported';
  isStandalonePWA: boolean;
  isIOS: boolean;
  hasPushManager: boolean;
  hasServiceWorker: boolean;
}

export interface PushSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  endpoint?: string;
  error?: string;
}

/**
 * Converte chave base64url do VAPID para Uint8Array conforme exigido pela especificação W3C Push API.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const atobFn = typeof atob !== 'undefined' ? atob : (globalThis as any).atob;
  const rawData = atobFn(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const notificationService = {
  getDiagnostics(): NotificationPlatformDiagnostics {
    if (typeof window === 'undefined') {
      return {
        supportStatus: 'unsupported',
        permission: 'unsupported',
        isStandalonePWA: false,
        isIOS: false,
        hasPushManager: false,
        hasServiceWorker: false,
      };
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalonePWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    const hasNotificationAPI = 'Notification' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;

    if (!hasNotificationAPI || !hasServiceWorker) {
      if (isIOS && !isStandalonePWA) {
        return {
          supportStatus: 'ios-browser-requires-install',
          permission: 'unsupported',
          isStandalonePWA,
          isIOS,
          hasPushManager,
          hasServiceWorker,
        };
      }
      return {
        supportStatus: 'unsupported',
        permission: 'unsupported',
        isStandalonePWA,
        isIOS,
        hasPushManager,
        hasServiceWorker,
      };
    }

    return {
      supportStatus: 'supported',
      permission: Notification.permission,
      isStandalonePWA,
      isIOS,
      hasPushManager,
      hasServiceWorker,
    };
  },

  /**
   * Solicita permissão de notificação APENAS mediante ação explícita do usuário (clique em botão).
   */
  async requestUserPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      return result;
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificação:', error);
      return Notification.permission;
    }
  },

  /**
   * Consulta a chave pública VAPID configurada no backend.
   */
  async fetchVapidPublicKey(): Promise<string> {
    const res = await fetch('/api/v1/vapid-public-key');
    if (!res.ok) {
      throw new Error(`Falha ao obter chave pública VAPID (${res.status}): ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.publicKey) {
      throw new Error('Chave pública VAPID não retornada pelo backend.');
    }
    return data.publicKey;
  },

  /**
   * Inscreve o navegador na Push API com a chave VAPID e envia a subscription para o backend autenticado.
   */
  async subscribeToPushNotifications(options?: {
    authToken?: string;
    deviceName?: string;
    hideMedicationNames?: boolean;
  }): Promise<PushSubscriptionResult> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return { success: false, error: 'Web Push não suportado neste navegador.' };
    }

    // 1. Garante permissão concedida
    let perm: NotificationPermission | 'unsupported' = Notification.permission;
    if (perm !== 'granted') {
      perm = await this.requestUserPermission();
      if (perm !== 'granted') {
        return { success: false, error: 'Permissão de notificações negada pelo usuário.' };
      }
    }

    // 2. Aguarda registro ativo do Service Worker
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) {
      return { success: false, error: 'PushManager não disponível no Service Worker.' };
    }

    try {
      // 3. Verifica se já existe uma subscription ativa neste navegador
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Obtém a chave pública VAPID do backend
        const vapidPublicKey = await this.fetchVapidPublicKey();
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

        // Cria a nova inscrição Web Push junto ao serviço de push do navegador (FCM / Mozilla)
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 4. Extrai chaves criptográficas p256dh e auth da subscription
      const rawP256dh = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');

      if (!rawP256dh || !rawAuth) {
        return { success: false, error: 'Falha ao extrair chaves da subscription Web Push.' };
      }

      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawP256dh))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(rawAuth))));

      // 5. Envia a subscription para persistência no backend SQLite
      const token = options?.authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('doses_access_token') : null);
      if (!token) {
        return {
          success: false,
          error: 'Sessão de usuário não autenticada no backend. Faça login para registrar notificações.',
        };
      }

      const deviceName =
        options?.deviceName ||
        (navigator.userAgent.includes('Mobile') ? 'Smartphone' : 'Computador');

      const backendResponse = await fetch('/api/v1/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
          deviceName,
          userAgent: navigator.userAgent,
          hideMedicationNames: options?.hideMedicationNames ?? true,
        }),
      });

      if (!backendResponse.ok) {
        const errJson = await backendResponse.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro HTTP ${backendResponse.status} ao registrar subscription`);
      }

      const resultData = await backendResponse.json();
      const subId = resultData.subscription?.id;

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('doses_push_subscribed', 'true');
        if (subId) localStorage.setItem('doses_push_subscription_id', subId);
      }

      return {
        success: true,
        subscriptionId: subId,
        endpoint: subscription.endpoint,
      };
    } catch (err: any) {
      console.error('[NotificationService] Falha no fluxo Web Push:', err);
      return {
        success: false,
        error: err.message || 'Falha ao ativar notificações Web Push.',
      };
    }
  },

  /**
   * Verifica o status atual da inscrição Web Push no navegador e Service Worker.
   */
  async getPushSubscriptionStatus(): Promise<{
    permission: NotificationPermission | 'unsupported';
    isSubscribed: boolean;
    endpoint?: string;
  }> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return { permission: 'unsupported', isSubscribed: false };
    }

    const permission = Notification.permission;
    if (permission !== 'granted') {
      return { permission, isSubscribed: false };
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        return { permission, isSubscribed: false };
      }
      const sub = await registration.pushManager.getSubscription();
      return {
        permission,
        isSubscribed: Boolean(sub),
        endpoint: sub?.endpoint,
      };
    } catch {
      return { permission, isSubscribed: false };
    }
  },

  /**
   * Dispara uma notificação local de demonstração/lembrete quando suportado e autorizado.
   */
  async sendLocalTestReminder(title: string, body: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            tag: 'doses-reminder-test',
          });
          return true;
        }
      }

      new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
      });
      return true;
    } catch (error) {
      console.error('Falha ao disparar notificação local:', error);
      return false;
    }
  },
};
