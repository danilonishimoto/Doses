import http from 'node:http';
import { z } from 'zod';
import { AuthService } from '../services/authService.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { loginRateLimiter, registerRateLimiter, refreshRateLimiter, getClientIp } from '../middlewares/rateLimiter.js';

// Schemas de validação Zod
const RegisterSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, 'O nome de usuário deve conter apenas letras, números, hífen ou sublinhado.'),
  password: z.string().min(8, 'A senha deve possuir no mínimo 8 caracteres.'),
  deviceName: z.string().optional(),
});

const LoginSchema = z.object({
  username: z.string().min(1, 'Nome de usuário obrigatório.'),
  password: z.string().min(1, 'Senha obrigatória.'),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'O token de atualização (refreshToken) é obrigatório.'),
});

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBodyJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Proteção contra payload excessivo (> 1MB)
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleAuthRoutes(
  req: AuthenticatedRequest,
  res: http.ServerResponse,
  authService: AuthService
): Promise<boolean> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const clientIp = getClientIp(req);

  // 1. POST /api/v1/auth/register
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/register') {
    const rate = registerRateLimiter.isAllowed(`register_${clientIp}`);
    if (!rate.allowed) {
      sendJson(res, 429, {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Muitas tentativas de cadastro. Tente novamente em ${rate.retryAfterSec} segundos.`,
      });
      return true;
    }

    try {
      const rawBody = await parseBodyJson(req);
      const parsed = RegisterSchema.safeParse(rawBody);

      if (!parsed.success) {
        sendJson(res, 400, {
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message || 'Dados de entrada inválidos.',
          details: parsed.error.issues,
        });
        return true;
      }

      const result = authService.register(parsed.data);
      sendJson(res, 201, result);
    } catch (err: any) {
      if (err.code === 'USERNAME_ALREADY_EXISTS') {
        sendJson(res, 409, {
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
        });
        return true;
      }
      sendJson(res, 400, {
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Erro ao processar cadastro.',
      });
    }
    return true;
  }

  // 2. POST /api/v1/auth/login
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
    try {
      const rawBody = await parseBodyJson(req);
      const parsed = LoginSchema.safeParse(rawBody);

      if (!parsed.success) {
        sendJson(res, 400, {
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message || 'Credenciais inválidas.',
        });
        return true;
      }

      const rateKey = `login_${clientIp}_${parsed.data.username}`;
      const rate = loginRateLimiter.isAllowed(rateKey);
      if (!rate.allowed) {
        sendJson(res, 429, {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Muitas tentativas de login falhas. Tente novamente em ${rate.retryAfterSec} segundos.`,
        });
        return true;
      }

      const result = authService.login(parsed.data);
      // Se login deu certo, reseta o rate limiter
      loginRateLimiter.reset(rateKey);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err.code === 'INVALID_CREDENTIALS') {
        sendJson(res, 401, {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Credenciais inválidas.',
        });
        return true;
      }
      sendJson(res, 500, {
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Erro interno ao processar login.',
      });
    }
    return true;
  }

  // 3. POST /api/v1/auth/refresh
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/refresh') {
    const rate = refreshRateLimiter.isAllowed(`refresh_${clientIp}`);
    if (!rate.allowed) {
      sendJson(res, 429, {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Muitas requisições de renovação. Tente novamente em ${rate.retryAfterSec} segundos.`,
      });
      return true;
    }

    try {
      const rawBody = await parseBodyJson(req);
      const parsed = RefreshSchema.safeParse(rawBody);

      if (!parsed.success) {
        sendJson(res, 400, {
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message || 'Token de renovação ausente.',
        });
        return true;
      }

      const result = authService.refresh(parsed.data);
      sendJson(res, 200, result);
    } catch (err: any) {
      if (err.code === 'TOKEN_REUSED_FAMILY_REVOKED') {
        sendJson(res, 401, {
          statusCode: 401,
          error: 'Unauthorized',
          code: 'TOKEN_REUSED',
          message: 'Tentativa de reutilização de token revogado detectada. Todas as sessões deste dispositivo foram encerradas.',
        });
        return true;
      }
      sendJson(res, 401, {
        statusCode: 401,
        error: 'Unauthorized',
        code: err.code || 'INVALID_REFRESH_TOKEN',
        message: err.message || 'Falha ao renovar sessão.',
      });
    }
    return true;
  }

  // 4. POST /api/v1/auth/logout
  if (req.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
    if (!authenticateToken(req, res, authService)) {
      return true;
    }

    authService.logout({
      sessionId: req.user!.sessionId,
      accountId: req.user!.accountId,
    });

    sendJson(res, 200, {
      message: 'Sessão encerrada com sucesso.',
    });
    return true;
  }

  // 5. GET /api/v1/auth/me
  if (req.method === 'GET' && url.pathname === '/api/v1/auth/me') {
    if (!authenticateToken(req, res, authService)) {
      return true;
    }

    const account = authService.getAccount(req.user!.accountId);
    if (!account) {
      sendJson(res, 404, {
        statusCode: 404,
        error: 'Not Found',
        message: 'Conta não encontrada.',
      });
      return true;
    }

    sendJson(res, 200, {
      account,
      sessionId: req.user!.sessionId,
    });
    return true;
  }

  // Rota não tratada por este router
  return false;
}
