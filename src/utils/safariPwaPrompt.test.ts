import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIosDevice,
  isIosSafari,
  isPwaStandalone,
  hasDismissedSafariPwaPrompt,
  dismissSafariPwaPrompt,
  shouldShowSafariPwaPrompt,
  SAFARI_PWA_DISMISSED_KEY,
} from './safariPwaPrompt';

// Mock localStorage para Node.js
const createLocalStorageMock = () => {
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
};

const mockStorage = createLocalStorageMock();
(globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;

// User agents de referência
const UA_IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const UA_IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1';
const UA_IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/123.0 Mobile/15E148 Safari/605.1.15';
const UA_IPAD_SAFARI_CLASSIC =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const UA_IPAD_SAFARI_MODERN =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const UA_MAC_SAFARI_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const UA_ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
const UA_WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

test('Detecção de Ambiente e Critérios de Exibição do Modal Safari iOS PWA', async (t) => {
  t.beforeEach(() => {
    mockStorage.clear();
  });

  await t.test('1. Primeiro acesso pelo Safari no iPhone deve autorizar a exibição do modal', () => {
    const env = {
      userAgent: UA_IPHONE_SAFARI,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: false,
      matchMediaStandalone: false,
    };

    assert.equal(isIosDevice(env), true, 'Deve identificar como dispositivo iOS');
    assert.equal(isIosSafari(env), true, 'Deve identificar como Safari no iOS');
    assert.equal(isPwaStandalone(env), false, 'Não deve estar em modo standalone');
    assert.equal(hasDismissedSafariPwaPrompt(), false, 'Não deve ter sido dispensado previamente');
    assert.equal(shouldShowSafariPwaPrompt(env), true, 'Modal deve ser exibido');
  });

  await t.test('2. Primeiro acesso pelo Safari no iPad (clássico e iPadOS moderno com touch) deve autorizar o modal', () => {
    // iPad clássico
    const envClassic = {
      userAgent: UA_IPAD_SAFARI_CLASSIC,
      platform: 'iPad',
      maxTouchPoints: 5,
      standalone: false,
    };
    assert.equal(isIosSafari(envClassic), true);
    assert.equal(shouldShowSafariPwaPrompt(envClassic), true);

    // iPadOS moderno (reporta MacIntel com maxTouchPoints > 1)
    const envModern = {
      userAgent: UA_IPAD_SAFARI_MODERN,
      platform: 'MacIntel',
      maxTouchPoints: 5,
      standalone: false,
    };
    assert.equal(isIosSafari(envModern), true);
    assert.equal(shouldShowSafariPwaPrompt(envModern), true);
  });

  await t.test('3. Acesso pelo Chrome no iPhone (CriOS) NÃO deve exibir o modal', () => {
    const env = {
      userAgent: UA_IPHONE_CHROME,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: false,
    };

    assert.equal(isIosDevice(env), true, 'É um dispositivo iOS');
    assert.equal(isIosSafari(env), false, 'Não deve ser considerado Safari nativo');
    assert.equal(shouldShowSafariPwaPrompt(env), false, 'Modal NÃO deve ser exibido');
  });

  await t.test('4. Acesso pelo Firefox no iPhone (FxiOS) NÃO deve exibir o modal', () => {
    const env = {
      userAgent: UA_IPHONE_FIREFOX,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: false,
    };

    assert.equal(isIosSafari(env), false);
    assert.equal(shouldShowSafariPwaPrompt(env), false);
  });

  await t.test('5. Acesso pelo Chrome no Android NÃO deve exibir o modal', () => {
    const env = {
      userAgent: UA_ANDROID_CHROME,
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      standalone: false,
    };

    assert.equal(isIosDevice(env), false);
    assert.equal(isIosSafari(env), false);
    assert.equal(shouldShowSafariPwaPrompt(env), false);
  });

  await t.test('6. Acesso por Desktop (Mac Safari desktop sem touch e Windows Chrome) NÃO deve exibir o modal', () => {
    // Mac Desktop Safari (maxTouchPoints = 0)
    const envMac = {
      userAgent: UA_MAC_SAFARI_DESKTOP,
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: false,
    };
    assert.equal(isIosDevice(envMac), false);
    assert.equal(isIosSafari(envMac), false);
    assert.equal(shouldShowSafariPwaPrompt(envMac), false);

    // Windows Chrome
    const envWindows = {
      userAgent: UA_WINDOWS_CHROME,
      platform: 'Win32',
      maxTouchPoints: 0,
      standalone: false,
    };
    assert.equal(isIosDevice(envWindows), false);
    assert.equal(isIosSafari(envWindows), false);
    assert.equal(shouldShowSafariPwaPrompt(envWindows), false);
  });

  await t.test('7. Acesso quando a aplicação já está instalada e executando em modo standalone NÃO deve exibir o modal', () => {
    // Standalone via propriedade navigator.standalone
    const envStandaloneNav = {
      userAgent: UA_IPHONE_SAFARI,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
    };
    assert.equal(isPwaStandalone(envStandaloneNav), true);
    assert.equal(shouldShowSafariPwaPrompt(envStandaloneNav), false);

    // Standalone via matchMedia display-mode: standalone
    const envStandaloneMedia = {
      userAgent: UA_IPHONE_SAFARI,
      platform: 'iPhone',
      maxTouchPoints: 5,
      matchMediaStandalone: true,
      standalone: false,
    };
    assert.equal(isPwaStandalone(envStandaloneMedia), true);
    assert.equal(shouldShowSafariPwaPrompt(envStandaloneMedia), false);
  });

  await t.test('8. Persistência de dispensa: após dispensar, o modal NÃO deve ser exibido em acessos subsequentes', () => {
    const env = {
      userAgent: UA_IPHONE_SAFARI,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: false,
    };

    // Primeiro acesso
    assert.equal(shouldShowSafariPwaPrompt(env), true);

    // Usuário fecha pelo X ou pelo botão
    dismissSafariPwaPrompt();
    assert.equal(mockStorage.getItem(SAFARI_PWA_DISMISSED_KEY), 'true');
    assert.equal(hasDismissedSafariPwaPrompt(), true);

    // Segundo acesso subsequente com mesmo ambiente
    assert.equal(shouldShowSafariPwaPrompt(env), false, 'Não deve exibir no segundo acesso');
  });
});
