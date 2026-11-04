/**
 * Service Worker complementar para manipulação de notificações Web Push.
 * Injetado no service worker principal do PWA via Workbox importScripts('/push-sw.js').
 */

// Listener do evento push recebido do backend via Web Push protocol
self.addEventListener('push', function (event) {
  console.info('[SW Push] Evento push recebido no Service Worker.');

  if (!event.data) {
    console.warn('[SW Push] Evento push recebido sem dados (payload vazio).');
    var fallbackTitle = 'Lembrete de Medicamento';
    var fallbackOptions = {
      body: 'Está na hora de tomar seu medicamento.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'dose-default-reminder',
    };
    event.waitUntil(self.registration.showNotification(fallbackTitle, fallbackOptions));
    return;
  }

  try {
    var payload = event.data.json();
    var title = payload.title || 'Lembrete de Medicamento';
    var data = payload.data || {};
    var occurrenceId = data.occurrenceId || '';

    // A tag permite que o navegador colapse/substitua lembretes idênticos sem duplicar notificações
    var tag = payload.tag || (occurrenceId ? 'dose-' + occurrenceId : 'dose-reminder');

    var options = {
      body: payload.body || 'Está na hora de tomar seu medicamento.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: tag,
      data: data,
      requireInteraction: true, // Mantém a notificação visível até o usuário interagir
      renotify: true,           // Emite novo alerta sonoro/vibração mesmo se a tag for substituída
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW Push] Erro ao interpretar payload JSON do push, tentando texto puro:', err);
    var rawText = event.data.text();
    var textTitle = 'Lembrete de Medicamento';
    var textOptions = {
      body: rawText || 'Está na hora de tomar seu medicamento.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'dose-raw-reminder',
    };
    event.waitUntil(self.registration.showNotification(textTitle, textOptions));
  }
});

// Listener de clique na notificação exibida
self.addEventListener('notificationclick', function (event) {
  console.info('[SW Push] Usuário clicou na notificação:', event.notification.tag);
  event.notification.close();

  // Foca na aba do PWA existente ou abre uma nova
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
