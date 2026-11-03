export type NotificationSupportStatus =
  | 'supported'
  | 'unsupported'
  | 'ios-browser-requires-install';

export interface NotificationPlatformDiagnostics {
  supportStatus: NotificationSupportStatus;
  permission: NotificationPermission | 'unsupported';
  isStandalonePWA: boolean;
  isIOS: boolean;
}

export const notificationService = {
  getDiagnostics(): NotificationPlatformDiagnostics {
    if (typeof window === 'undefined') {
      return {
        supportStatus: 'unsupported',
        permission: 'unsupported',
        isStandalonePWA: false,
        isIOS: false,
      };
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalonePWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

    const hasNotificationAPI = 'Notification' in window;

    if (!hasNotificationAPI) {
      if (isIOS && !isStandalonePWA) {
        return {
          supportStatus: 'ios-browser-requires-install',
          permission: 'unsupported',
          isStandalonePWA,
          isIOS,
        };
      }
      return {
        supportStatus: 'unsupported',
        permission: 'unsupported',
        isStandalonePWA,
        isIOS,
      };
    }

    return {
      supportStatus: 'supported',
      permission: Notification.permission,
      isStandalonePWA,
      isIOS,
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
