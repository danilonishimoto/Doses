import crypto from 'node:crypto';

// Parâmetros explícitos recomendados pela OWASP para Scrypt
export const SCRYPT_CONFIG = {
  N: 16384, // Cost factor (CPU/memory)
  r: 8,     // Block size
  p: 1,     // Parallelization parameter
  maxmem: 32 * 1024 * 1024, // 32MB
  keylen: 64, // 64 bytes derivada
} as const;

/**
 * Gera um hash seguro da senha utilizando Scrypt nativo com salt criptográfico aleatório.
 * Formato retornado: $scrypt$N=16384,r=8,p=1$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Senha inválida para hashing');
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_CONFIG.keylen, {
    N: SCRYPT_CONFIG.N,
    r: SCRYPT_CONFIG.r,
    p: SCRYPT_CONFIG.p,
    maxmem: SCRYPT_CONFIG.maxmem,
  });

  return `$scrypt$N=${SCRYPT_CONFIG.N},r=${SCRYPT_CONFIG.r},p=${SCRYPT_CONFIG.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Valida a senha comparando o hash armazenado em tempo constante (timingSafeEqual).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!password || !storedHash) return false;

    // Formato esperado: $scrypt$N=...,r=...,p=...$salt$derivedKey
    const parts = storedHash.split('$');
    if (parts.length !== 5 || parts[1] !== 'scrypt') {
      return false;
    }

    const paramsStr = parts[2];
    const saltHex = parts[3];
    const originalHashHex = parts[4];

    // Extrai parâmetros
    const paramsMap = new Map<string, number>();
    for (const param of paramsStr.split(',')) {
      const [k, v] = param.split('=');
      paramsMap.set(k, parseInt(v, 10));
    }

    const N = paramsMap.get('N') || SCRYPT_CONFIG.N;
    const r = paramsMap.get('r') || SCRYPT_CONFIG.r;
    const p = paramsMap.get('p') || SCRYPT_CONFIG.p;

    const salt = Buffer.from(saltHex, 'hex');
    const originalHash = Buffer.from(originalHashHex, 'hex');

    const derivedAttempt = crypto.scryptSync(password, salt, originalHash.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_CONFIG.maxmem,
    });

    return crypto.timingSafeEqual(originalHash, derivedAttempt);
  } catch (error) {
    return false;
  }
}

/**
 * Gera um Refresh Token opaco com 256 bits de entropia (32 bytes em formato hexadecimal).
 */
export function generateOpaqueRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gera o hash SHA-256 do Refresh Token para armazenamento seguro no banco de dados.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
