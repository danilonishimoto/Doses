export const SAFARI_PWA_DISMISSED_KEY = 'doses_pwa_safari_onboarding_dismissed';

export interface DeviceEnvironment {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  matchMediaStandalone?: boolean;
}

/**
 * Detecta se o dispositivo é iOS/iPadOS.
 * - iPhone/iPod: indicado por 'iPhone' ou 'iPod' no User Agent.
 * - iPad: indicado por 'iPad' no User Agent ou iPadOS 13+ (platform 'MacIntel' com maxTouchPoints > 1).
 * - Exclui desktop macOS (platform 'MacIntel' sem toque ou com maxTouchPoints <= 1).
 * - Exclui Android, Windows e Linux.
 */
export function isIosDevice(env?: DeviceEnvironment): boolean {
  const ua = env?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const platform = env?.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '');
  const maxTouchPoints = env?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);

  // Se explicitamente possui Android ou Windows, não é iOS
  if (/Android|Windows|Linux/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua)) {
    return false;
  }

  const isIosUa = /iPhone|iPad|iPod/i.test(ua);
  const isIpadOS = platform === 'MacIntel' && maxTouchPoints > 1;

  return isIosUa || isIpadOS;
}

/**
 * Detecta se o navegador é o Safari em dispositivo iOS/iPadOS.
 * Exclui:
 * - Chrome no iOS ('CriOS')
 * - Firefox no iOS ('FxiOS')
 * - Edge no iOS ('EdgiOS')
 * - Opera no iOS ('OPT/', 'OPR/', 'OPiOS')
 * - DuckDuckGo no iOS
 * - Desktop Safari ou outros navegadores desktop
 * - Android
 */
export function isIosSafari(env?: DeviceEnvironment): boolean {
  if (!isIosDevice(env)) {
    return false;
  }

  const ua = env?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  // Exclui navegadores de terceiros no iOS
  const isOtherBrowserOnIos = /CriOS|FxiOS|EdgiOS|OPT\/|OPR\/|OPiOS|DuckDuckGo/i.test(ua);
  if (isOtherBrowserOnIos) {
    return false;
  }

  // No Safari para iOS legítimo, contém 'Safari' e 'AppleWebKit'
  const isSafari = /Safari/i.test(ua) && /AppleWebKit/i.test(ua);
  return isSafari;
}

/**
 * Detecta se o aplicativo já está sendo executado em modo standalone (PWA instalado).
 */
export function isPwaStandalone(env?: DeviceEnvironment): boolean {
  if (env?.standalone === true || env?.matchMediaStandalone === true) {
    return true;
  }
  if (env?.standalone !== undefined && env?.matchMediaStandalone === undefined) {
    return env.standalone;
  }
  if (env?.matchMediaStandalone !== undefined && env?.standalone === undefined) {
    return env.matchMediaStandalone;
  }

  if (typeof window !== 'undefined') {
    try {
      const mediaMatches = window.matchMedia?.('(display-mode: standalone)')?.matches;
      if (mediaMatches) return true;
    } catch {
      // Ignora falhas em ambientes sem matchMedia
    }
  }

  if (typeof navigator !== 'undefined') {
    const navStandalone = (navigator as unknown as { standalone?: boolean })?.standalone;
    if (navStandalone) return true;
  }

  return false;
}

/**
 * Verifica se o usuário já dispensou a orientação de instalação do Safari no localStorage.
 */
export function hasDismissedSafariPwaPrompt(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SAFARI_PWA_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Salva a dispensa da orientação no localStorage.
 */
export function dismissSafariPwaPrompt(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAFARI_PWA_DISMISSED_KEY, 'true');
    }
  } catch {
    // Ignora restrições de storage (modo privado / iframe restrito)
  }
}

/**
 * Avalia se o modal de orientação deve ser exibido.
 * Retorna true exclusivamente para:
 * 1. Acesso pelo Safari no iOS/iPadOS;
 * 2. Em execução dentro do navegador (NÃO standalone);
 * 3. Ainda não dispensado pelo usuário.
 */
export function shouldShowSafariPwaPrompt(env?: DeviceEnvironment): boolean {
  return isIosSafari(env) && !isPwaStandalone(env) && !hasDismissedSafariPwaPrompt();
}
