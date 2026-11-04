import http from 'node:http';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxAttempts: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxAttempts: number = 10) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;

    // Limpeza periódica para não reter chaves expiradas na memória
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, 60 * 1000).unref();
  }

  isAllowed(key: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxAttempts - 1, retryAfterSec: 0 };
    }

    if (entry.count >= this.maxAttempts) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxAttempts - entry.count, retryAfterSec: 0 };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

// Limitadores instanciados por tipo de operação
export const loginRateLimiter = new InMemoryRateLimiter(15 * 60 * 1000, 5); // 5 tentativas em 15 min
export const registerRateLimiter = new InMemoryRateLimiter(60 * 60 * 1000, 10); // 10 registros por hora por IP
export const refreshRateLimiter = new InMemoryRateLimiter(5 * 60 * 1000, 30); // 30 refreshes por 5 min

export function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}
