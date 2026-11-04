import webpush from 'web-push';
import { env } from './env.js';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Gera um novo par de chaves VAPID criptograficamente seguras para desenvolvimento local.
 */
export function generateLocalVapidKeys(): VapidKeys {
  return webpush.generateVAPIDKeys();
}

/**
 * Inicializa a biblioteca web-push com as chaves configuradas.
 */
export function configureVapid(): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn(
      '[VAPID] Chaves VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configuradas no ambiente. Execute `npm run generate-vapid`.'
    );
    return false;
  }

  try {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    return true;
  } catch (error) {
    console.error('[VAPID] Falha ao configurar credenciais VAPID:', error);
    return false;
  }
}

export { webpush };
