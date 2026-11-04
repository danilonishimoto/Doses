import assert from 'node:assert';
import { urlBase64ToUint8Array, notificationService } from './notificationService';
import { buildNotificationPayload } from '../../server/src/utils/payloadBuilder';

async function runNotificationServiceTests() {
  console.log('================================================================');
  console.log('  Suíte de Testes — Frontend Web Push e Service Worker          ');
  console.log('================================================================\n');

  let passed = 0;

  // -------------------------------------------------------------
  // Teste 1: urlBase64ToUint8Array
  // -------------------------------------------------------------
  const sampleBase64Url = 'BEkAYOWg3PFsSbsELBJSyqI69fKz80Xq1V8fS9zL30M';
  const uint8Arr = urlBase64ToUint8Array(sampleBase64Url);
  assert.ok(uint8Arr instanceof Uint8Array);
  assert.ok(uint8Arr.length > 0);
  console.log('✓ Teste 1: urlBase64ToUint8Array converteu chave VAPID base64url em Uint8Array');
  passed++;

  // -------------------------------------------------------------
  // Teste 2: getDiagnostics em ambiente node
  // -------------------------------------------------------------
  const diag = notificationService.getDiagnostics();
  assert.strictEqual(typeof diag, 'object');
  assert.ok('supportStatus' in diag);
  assert.ok('permission' in diag);
  console.log('✓ Teste 2: getDiagnostics retorna diagnóstico de plataforma sem lançar exceções');
  passed++;

  // -------------------------------------------------------------
  // Teste 3: Compatibilidade do Payload entre Backend e Service Worker
  // -------------------------------------------------------------
  // Simula payload gerado pelo backend Doses (com hideMedicationNames = false)
  const backendPayload = buildNotificationPayload({
    occurrenceId: 'occ_test_compat_123',
    scheduledTime: '08:30',
    profileId: 'prof_joao',
    profileName: 'João',
    medicationName: 'Dipirona',
    dosage: '500mg',
    hideMedicationNames: false,
  });

  const fullPushPayload = {
    title: backendPayload.title,
    body: backendPayload.body,
    data: backendPayload.data,
    tag: `dose-${backendPayload.data.occurrenceId}`,
  };

  // Simula lógica de extração do public/push-sw.js
  const extractedTitle = fullPushPayload.title || 'Lembrete de Medicamento';
  const extractedBody = fullPushPayload.body || '';
  const extractedTag = fullPushPayload.tag;
  const extractedData = fullPushPayload.data;

  assert.strictEqual(extractedTitle, 'Lembrete: Dipirona');
  assert.strictEqual(extractedBody, 'Está na hora do medicamento Dipirona (500mg) do João');
  assert.strictEqual(extractedTag, 'dose-occ_test_compat_123');
  assert.strictEqual(extractedData.profileName, 'João');
  assert.strictEqual(extractedData.hideMedicationNames, false);

  console.log('✓ Teste 3: Payload do backend é 100% interpretável pelo push-sw.js (modo detalhado)');
  passed++;

  // -------------------------------------------------------------
  // Teste 4: Compatibilidade com Privacidade Ativa (hideMedicationNames = true)
  // -------------------------------------------------------------
  const privateBackendPayload = buildNotificationPayload({
    occurrenceId: 'occ_test_privacy_456',
    scheduledTime: '14:00',
    profileId: 'prof_maria',
    profileName: 'Maria',
    medicationName: 'Rivotril',
    dosage: '2mg',
    hideMedicationNames: true,
  });

  const fullPrivatePushPayload = {
    title: privateBackendPayload.title,
    body: privateBackendPayload.body,
    data: privateBackendPayload.data,
    tag: `dose-${privateBackendPayload.data.occurrenceId}`,
  };

  assert.strictEqual(fullPrivatePushPayload.title, 'Lembrete de Medicamento');
  assert.strictEqual(fullPrivatePushPayload.body, 'Está na hora de um medicamento do Maria');
  assert.strictEqual(fullPrivatePushPayload.tag, 'dose-occ_test_privacy_456');
  assert.strictEqual(fullPrivatePushPayload.data.hideMedicationNames, true);
  assert.strictEqual(fullPrivatePushPayload.data.medicationName, undefined);
  assert.strictEqual(fullPrivatePushPayload.body.includes('Rivotril'), false);

  console.log('✓ Teste 4: Payload com privacidade oculta medicamento e preserva perfil para o SW');
  passed++;

  // -------------------------------------------------------------
  // Teste 5: Simulação de Subscription Web Push com mock da API de Push do Browser
  // -------------------------------------------------------------
  let capturedBackendPost: any = null;
  const originalFetch = global.fetch;

  const mockNotification = {
    permission: 'granted',
    requestPermission: async () => 'granted',
  };
  (globalThis as any).Notification = mockNotification;
  (globalThis as any).window = {
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    Notification: mockNotification,
  };

  const mockNavigator = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    serviceWorker: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => null,
          subscribe: async (opts: any) => {
            assert.strictEqual(opts.userVisibleOnly, true);
            assert.ok(opts.applicationServerKey instanceof Uint8Array);
            return {
              endpoint: 'https://fcm.googleapis.com/fcm/send/mock_token_123',
              getKey: (name: string) => {
                if (name === 'p256dh') return Buffer.from('mock_p256dh');
                if (name === 'auth') return Buffer.from('mock_auth');
                return null;
              },
            };
          },
        },
      }),
    },
  };
  Object.defineProperty(globalThis, 'navigator', { value: mockNavigator, configurable: true });

  global.fetch = async (url: any, opts: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/api/v1/vapid-public-key')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ publicKey: 'BMBVhzozY8Xn6328IOhuVapidKeyMock' }),
      } as any;
    }
    if (urlStr.includes('/api/v1/push-subscriptions')) {
      capturedBackendPost = {
        url: urlStr,
        headers: opts.headers,
        body: JSON.parse(opts.body),
      };
      return {
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          subscription: { id: 'sub_mock_id_789' },
        }),
      } as any;
    }
    return { ok: false, status: 404 } as any;
  };

  const subResult = await notificationService.subscribeToPushNotifications({
    authToken: 'jwt_mock_token_abc',
    deviceName: 'Meu MacBook',
    hideMedicationNames: true,
  });

  if (!subResult.success) {
    console.error('subResult failed with error:', subResult.error);
  }

  assert.strictEqual(subResult.success, true);
  assert.strictEqual(subResult.subscriptionId, 'sub_mock_id_789');
  assert.ok(capturedBackendPost !== null);
  assert.strictEqual(capturedBackendPost.headers.Authorization, 'Bearer jwt_mock_token_abc');
  assert.strictEqual(capturedBackendPost.body.endpoint, 'https://fcm.googleapis.com/fcm/send/mock_token_123');
  assert.strictEqual(capturedBackendPost.body.deviceName, 'Meu MacBook');
  assert.strictEqual(capturedBackendPost.body.hideMedicationNames, true);

  // Restaura ambiente
  global.fetch = originalFetch;

  console.log('✓ Teste 5: Fluxo de inscrição ponta a ponta gerou e postou subscription com auth correta');
  passed++;

  console.log('\n================================================================');
  console.log(`  RESULTADO: ${passed} de 5 testes do Frontend APROVADOS!       `);
  console.log('================================================================');
}

runNotificationServiceTests().catch((err) => {
  console.error('\n[FALHA NO TESTE DE NOTIFICAÇÕES]:', err);
  process.exit(1);
});
