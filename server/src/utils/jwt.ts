import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string;       // accountId
  sid: string;       // sessionId
  username: string;  // nome de usuário
  iat: number;       // timestamp de emissão (segundos)
  exp: number;       // timestamp de expiração (segundos)
  iss: string;       // emissor
  aud: string;       // audiência
}

export const JWT_CONFIG = {
  algorithm: 'HS256',
  expiresInSeconds: 15 * 60, // 15 minutos
  issuer: 'doses-backend',
  audience: 'doses-pwa',
} as const;

function base64UrlEncode(str: string | Buffer): string {
  const buf = typeof str === 'string' ? Buffer.from(str, 'utf-8') : str;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Emite um JWT seguro assinado com HMAC-SHA256 contendo emissor e audiência estritos.
 */
export function signJwt(
  payload: { sub: string; sid: string; username: string },
  customSecret?: string,
  customExpiresIn?: number
): string {
  const secret = customSecret || env.JWT_SECRET;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (customExpiresIn !== undefined ? customExpiresIn : JWT_CONFIG.expiresInSeconds);

  const header = {
    alg: JWT_CONFIG.algorithm,
    typ: 'JWT',
  };

  const fullPayload: JwtPayload = {
    sub: payload.sub,
    sid: payload.sid,
    username: payload.username,
    iat: now,
    exp,
    iss: JWT_CONFIG.issuer,
    aud: JWT_CONFIG.audience,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signatureInput);
  const signature = base64UrlEncode(hmac.digest());

  return `${signatureInput}.${signature}`;
}

export interface VerifyJwtResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: 'MALFORMED' | 'UNSUPPORTED_ALGORITHM' | 'INVALID_SIGNATURE' | 'EXPIRED' | 'INVALID_ISSUER' | 'INVALID_AUDIENCE';
}

/**
 * Valida o JWT de forma estrita: verifica assinatura, algoritmo permitido, expiração, emissor e audiência.
 */
export function verifyJwt(token: string, customSecret?: string): VerifyJwtResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'MALFORMED' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'MALFORMED' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // 1. Decodifica e valida o header
  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch {
    return { valid: false, error: 'MALFORMED' };
  }

  // Validação estrita de algoritmo: rejeita explicitamente 'none' ou qualquer algoritmo diferente de HS256
  if (header.alg !== JWT_CONFIG.algorithm) {
    return { valid: false, error: 'UNSUPPORTED_ALGORITHM' };
  }

  // 2. Valida a assinatura com comparação em tempo constante
  const secret = customSecret || env.JWT_SECRET;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signatureInput);
  const expectedSignature = base64UrlEncode(hmac.digest());

  const sigBuf = Buffer.from(encodedSignature);
  const expectedSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  // 3. Decodifica o payload e valida regras temporais e de escopo
  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return { valid: false, error: 'MALFORMED' };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Expiração estrita
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { valid: false, error: 'EXPIRED', payload };
  }

  // Emissor e Audiência estritos
  if (payload.iss !== JWT_CONFIG.issuer) {
    return { valid: false, error: 'INVALID_ISSUER' };
  }

  if (payload.aud !== JWT_CONFIG.audience) {
    return { valid: false, error: 'INVALID_AUDIENCE' };
  }

  return { valid: true, payload };
}
