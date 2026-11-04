import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../db/connection.js';
import { hashPassword, verifyPassword, generateOpaqueRefreshToken, hashRefreshToken } from '../utils/crypto.js';
import { signJwt } from '../utils/jwt.js';
import { env } from '../config/env.js';

export interface AccountPublic {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  account: AccountPublic;
  sessionId: string;
}

export class AuthService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  /**
   * Realiza o cadastro de uma nova conta de usuário.
   */
  register(input: { username: string; password: string; deviceName?: string }): AuthTokens {
    const username = input.username.trim().toLowerCase();

    // 1. Validações básicas de formato
    if (username.length < 3 || username.length > 30) {
      throw new Error('O nome de usuário deve ter entre 3 e 30 caracteres.');
    }

    if (!input.password || input.password.length < 8) {
      throw new Error('A senha deve ter no mínimo 8 caracteres.');
    }

    // 2. Verifica unicidade de username
    const existing = this.db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
    if (existing) {
      // Erro explicativo para cadastro duplicado
      const err = new Error('Este nome de usuário já está em uso.');
      (err as any).code = 'USERNAME_ALREADY_EXISTS';
      throw err;
    }

    // 3. Hash com Scrypt e geração de chaves
    const passwordHash = hashPassword(input.password);
    const accountId = 'acc_' + crypto.randomUUID();
    const sessionId = 'ses_' + crypto.randomUUID();
    const deviceId = 'dev_' + crypto.randomUUID();
    const tokenFamily = 'fam_' + crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // 4. Cria conta, perfil principal e primeira sessão em transação
    const createTx = this.db.transaction(() => {
      // Inserção da conta
      this.db.prepare(`
        INSERT INTO accounts (id, username, password_hash, salt, created_at, updated_at)
        VALUES (?, ?, ?, 'scrypt_modular', datetime('now'), datetime('now'))
      `).run(accountId, username, passwordHash);

      // Inserção do perfil principal padrão (Camilla ou nome da conta)
      const profileId = 'prof_' + crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO profiles (id, account_id, name, avatar, is_main_profile, version, created_at, updated_at)
        VALUES (?, ?, ?, 'young-woman', 1, 1, datetime('now'), datetime('now'))
      `).run(profileId, accountId, username);

      // Gera refresh token opaco
      const refreshToken = generateOpaqueRefreshToken();
      const tokenHash = hashRefreshToken(refreshToken);
      const expiresAtSec = Math.floor(Date.now() / 1000) + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400;

      this.db.prepare(`
        INSERT INTO auth_sessions (
          id, account_id, device_id, refresh_token_hash, token_family,
          is_revoked, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
      `).run(sessionId, accountId, deviceId, tokenHash, tokenFamily, expiresAtSec);

      return { refreshToken };
    });

    const { refreshToken } = createTx();

    const accessToken = signJwt({
      sub: accountId,
      sid: sessionId,
      username,
    });

    return {
      accessToken,
      refreshToken,
      account: {
        id: accountId,
        username,
        createdAt: nowIso,
      },
      sessionId,
    };
  }

  /**
   * Autentica o usuário validando credenciais com Scrypt em tempo constante.
   */
  login(input: { username: string; password: string; deviceId?: string; deviceName?: string }): AuthTokens {
    const username = input.username.trim().toLowerCase();

    // Mensagem neutra para evitar enumeração de contas
    const invalidCredentialsError = () => {
      const err = new Error('Credenciais inválidas.');
      (err as any).code = 'INVALID_CREDENTIALS';
      return err;
    };

    const account = this.db.prepare(`
      SELECT id, username, password_hash, created_at
      FROM accounts
      WHERE username = ?
    `).get(username) as { id: string; username: string; password_hash: string; created_at: string } | undefined;

    if (!account) {
      throw invalidCredentialsError();
    }

    const passwordMatches = verifyPassword(input.password, account.password_hash);
    if (!passwordMatches) {
      throw invalidCredentialsError();
    }

    // Cria nova sessão para este dispositivo
    const sessionId = 'ses_' + crypto.randomUUID();
    const deviceId = input.deviceId || 'dev_' + crypto.randomUUID();
    const tokenFamily = 'fam_' + crypto.randomUUID();
    const refreshToken = generateOpaqueRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAtSec = Math.floor(Date.now() / 1000) + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400;

    this.db.prepare(`
      INSERT INTO auth_sessions (
        id, account_id, device_id, refresh_token_hash, token_family,
        is_revoked, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
    `).run(sessionId, account.id, deviceId, tokenHash, tokenFamily, expiresAtSec);

    const accessToken = signJwt({
      sub: account.id,
      sid: sessionId,
      username: account.username,
    });

    return {
      accessToken,
      refreshToken,
      account: {
        id: account.id,
        username: account.username,
        createdAt: account.created_at,
      },
      sessionId,
    };
  }

  /**
   * Renova a sessão rotacionando o Refresh Token e detectando reutilizações suspeitas.
   */
  refresh(input: { refreshToken: string }): { accessToken: string; refreshToken: string } {
    if (!input.refreshToken || typeof input.refreshToken !== 'string') {
      const err = new Error('Token de atualização inválido ou não fornecido.');
      (err as any).code = 'INVALID_TOKEN';
      throw err;
    }

    const currentHash = hashRefreshToken(input.refreshToken);

    // Busca a sessão correspondente ao hash do refresh token apresentado
    const session = this.db.prepare(`
      SELECT s.id, s.account_id, s.device_id, s.token_family, s.is_revoked, s.expires_at, a.username
      FROM auth_sessions s
      JOIN accounts a ON a.id = s.account_id
      WHERE s.refresh_token_hash = ?
    `).get(currentHash) as {
      id: string;
      account_id: string;
      device_id: string;
      token_family: string;
      is_revoked: number;
      expires_at: number;
      username: string;
    } | undefined;

    if (!session) {
      const err = new Error('Sessão não encontrada ou token inexistente.');
      (err as any).code = 'INVALID_TOKEN';
      throw err;
    }

    // DETECÇÃO DE REUTILIZAÇÃO (REUSE DETECTION):
    // Se o token apresentado já havia sido revogado/rotacionado anteriormente,
    // significa que uma cópia antiga vazou ou foi interceptada.
    if (session.is_revoked === 1) {
      // Invalida imediatamente toda a família de sessões daquela conta
      this.db.prepare(`
        UPDATE auth_sessions
        SET is_revoked = 1,
            revoked_at = datetime('now'),
            updated_at = datetime('now')
        WHERE account_id = ? AND token_family = ?
      `).run(session.account_id, session.token_family);

      const err = new Error('Tentativa de reutilização de token revogado detectada. Sessão invalidada por segurança.');
      (err as any).code = 'TOKEN_REUSED_FAMILY_REVOKED';
      throw err;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (session.expires_at <= nowSec) {
      // Marca como expirado/revogado
      this.db.prepare(`
        UPDATE auth_sessions
        SET is_revoked = 1,
            revoked_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(session.id);

      const err = new Error('A sessão expirou. É necessário fazer login novamente.');
      (err as any).code = 'TOKEN_EXPIRED';
      throw err;
    }

    // Rotação atômica em transação
    const rotateTx = this.db.transaction(() => {
      const newRefreshToken = generateOpaqueRefreshToken();
      const newHash = hashRefreshToken(newRefreshToken);
      const newSessionId = 'ses_' + crypto.randomUUID();
      const newExpiresAtSec = nowSec + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400;

      // Invalida atomicamente a sessão atual (condição is_revoked = 0 protege contra concorrência simultânea)
      const updateResult = this.db.prepare(`
        UPDATE auth_sessions
        SET is_revoked = 1,
            revoked_at = datetime('now'),
            replaced_by_hash = ?,
            updated_at = datetime('now')
        WHERE id = ? AND is_revoked = 0
      `).run(newHash, session.id);

      if (updateResult.changes !== 1) {
        // Outro processo concorrente utilizou este mesmo token exatamente no mesmo milissegundo!
        // Trata como conflito de reuso e revoga a família
        this.db.prepare(`
          UPDATE auth_sessions
          SET is_revoked = 1,
              revoked_at = datetime('now'),
              updated_at = datetime('now')
          WHERE account_id = ? AND token_family = ?
        `).run(session.account_id, session.token_family);

        const err = new Error('Conflito concorrente na renovação de token. Sessão invalidada.');
        (err as any).code = 'CONCURRENT_REFRESH_CONFLICT';
        throw err;
      }

      // Cria a nova sessão na mesma família e para o mesmo dispositivo
      this.db.prepare(`
        INSERT INTO auth_sessions (
          id, account_id, device_id, refresh_token_hash, token_family,
          is_revoked, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))
      `).run(newSessionId, session.account_id, session.device_id, newHash, session.token_family, newExpiresAtSec);

      const newAccessToken = signJwt({
        sub: session.account_id,
        sid: newSessionId,
        username: session.username,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });

    return rotateTx();
  }

  /**
   * Encerra a sessão atual (Logout).
   */
  logout(input: { sessionId: string; accountId: string }): boolean {
    const result = this.db.prepare(`
      UPDATE auth_sessions
      SET is_revoked = 1,
          revoked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(input.sessionId, input.accountId);

    return result.changes === 1;
  }

  /**
   * Revoga todas as sessões de uma família inteira (Logout de um dispositivo específico).
   */
  revokeFamily(input: { tokenFamily: string; accountId: string }): number {
    const result = this.db.prepare(`
      UPDATE auth_sessions
      SET is_revoked = 1,
          revoked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE account_id = ? AND token_family = ? AND is_revoked = 0
    `).run(input.accountId, input.tokenFamily);

    return result.changes;
  }

  /**
   * Retorna os dados públicos da conta autenticada.
   */
  getAccount(accountId: string): AccountPublic | null {
    const row = this.db.prepare(`
      SELECT id, username, created_at
      FROM accounts
      WHERE id = ?
    `).get(accountId) as { id: string; username: string; created_at: string } | undefined;

    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
    };
  }

  /**
   * Verifica se a sessão identificada pelo token ainda está ativa no banco.
   */
  isSessionActive(sessionId: string, accountId: string): boolean {
    const session = this.db.prepare(`
      SELECT is_revoked, expires_at
      FROM auth_sessions
      WHERE id = ? AND account_id = ?
    `).get(sessionId, accountId) as { is_revoked: number; expires_at: number } | undefined;

    if (!session) return false;
    if (session.is_revoked === 1) return false;

    const nowSec = Math.floor(Date.now() / 1000);
    return session.expires_at > nowSec;
  }
}
