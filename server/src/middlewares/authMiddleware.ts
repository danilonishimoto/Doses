import http from 'node:http';
import { verifyJwt } from '../utils/jwt.js';
import { AuthService } from '../services/authService.js';

export interface AuthenticatedUser {
  accountId: string;
  sessionId: string;
  username: string;
}

export interface AuthenticatedRequest extends http.IncomingMessage {
  user?: AuthenticatedUser;
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: http.ServerResponse,
  authService?: AuthService
): boolean {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Token de autenticação não fornecido ou formato inválido. Use "Bearer <token>".',
      })
    );
    return false;
  }

  const token = authHeader.substring(7).trim();
  const verification = verifyJwt(token);

  if (!verification.valid || !verification.payload) {
    let message = 'Token de autenticação inválido.';
    if (verification.error === 'EXPIRED') {
      message = 'O token de autenticação expirou. Renove sua sessão através do refresh token.';
    }

    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        statusCode: 401,
        error: 'Unauthorized',
        code: verification.error,
        message,
      })
    );
    return false;
  }

  // Verifica se a sessão correspondente foi revogada no banco de dados (ex: logout)
  const service = authService || new AuthService();
  const sessionIsActive = service.isSessionActive(verification.payload.sid, verification.payload.sub);

  if (!sessionIsActive) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'SESSION_REVOKED',
        message: 'A sessão associada a este token foi encerrada ou revogada.',
      })
    );
    return false;
  }

  req.user = {
    accountId: verification.payload.sub,
    sessionId: verification.payload.sid,
    username: verification.payload.username,
  };

  return true;
}
