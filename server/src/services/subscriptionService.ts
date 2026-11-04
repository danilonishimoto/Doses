import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../db/connection.js';

export interface PushSubscriptionPublic {
  id: string;
  deviceName: string;
  userAgent: string;
  hideMedicationNames: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceName?: string;
  userAgent?: string;
  hideMedicationNames?: boolean;
}

export type RegisterSubscriptionResult =
  | {
      success: true;
      subscription: PushSubscriptionPublic;
      created: boolean;
    }
  | {
      success: false;
      error: 'ENDPOINT_OWNED_BY_ANOTHER_ACCOUNT';
      statusCode: 409;
      message: string;
    };

export type PushErrorTarget =
  | string
  | { subscriptionId?: string; endpoint?: string };

export interface PushErrorResult {
  action: 'DEACTIVATED' | 'IGNORED';
  reason: string;
  affectedRows: number;
}

interface SubscriptionRow {
  id: string;
  account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  device_name: string;
  hide_medication_names: number;
  is_active: number;
  created_at: string;
  last_seen_at: string;
  updated_at: string;
}

export class SubscriptionService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb || getDatabase();
  }

  private mapRowToPublic(row: any): PushSubscriptionPublic {
    return {
      id: row.id,
      deviceName: row.device_name || '',
      userAgent: row.user_agent || '',
      hideMedicationNames: Boolean(row.hide_medication_names),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Registra uma nova inscrição Web Push ou atualiza uma existente.
   * - Garante que o accountId venha exclusivamente da autenticação JWT.
   * - Se o endpoint pertencer à mesma conta: atualiza chaves e preferências sem duplicar.
   * - Se o endpoint pertencer a OUTRA conta (ativa ou inativa): rejeita incondicionalmente com 409 Conflict.
   * - Nunca transfere a propriedade de um endpoint entre contas distintas.
   */
  registerSubscription(
    accountId: string,
    input: RegisterSubscriptionInput
  ): RegisterSubscriptionResult {
    if (!accountId || typeof accountId !== 'string') {
      const err = new Error('Identificador de conta inválido.');
      (err as any).code = 'INVALID_ACCOUNT';
      throw err;
    }

    if (!input.endpoint || typeof input.endpoint !== 'string' || !/^https?:\/\//.test(input.endpoint)) {
      const err = new Error('Endpoint Web Push inválido ou ausente.');
      (err as any).code = 'INVALID_ENDPOINT';
      throw err;
    }

    if (!input.keys || typeof input.keys.p256dh !== 'string' || !input.keys.p256dh.trim()) {
      const err = new Error('Chave p256dh é obrigatória.');
      (err as any).code = 'INVALID_P256DH';
      throw err;
    }

    if (!input.keys.auth || typeof input.keys.auth !== 'string' || !input.keys.auth.trim()) {
      const err = new Error('Chave auth é obrigatória.');
      (err as any).code = 'INVALID_AUTH';
      throw err;
    }

    const deviceName = input.deviceName?.trim() || '';
    const userAgent = input.userAgent?.trim() || '';

    // Transação imediata (BEGIN IMMEDIATE) para evitar condições de corrida entre SELECT e INSERT/UPDATE
    const tx = this.db.transaction((): { success: true; id: string; created: boolean } | { success: false; error: 'ENDPOINT_OWNED_BY_ANOTHER_ACCOUNT'; statusCode: 409; message: string } => {
      const existing = this.db
        .prepare('SELECT id, account_id, hide_medication_names, is_active FROM push_subscriptions WHERE endpoint = ?')
        .get(input.endpoint) as { id: string; account_id: string; hide_medication_names: number; is_active: number } | undefined;

      if (existing) {
        // REGRA DE SEGURANÇA: Se pertence a outra conta (ativa ou inativa), REJEITA incondicionalmente
        if (existing.account_id !== accountId) {
          return {
            success: false,
            error: 'ENDPOINT_OWNED_BY_ANOTHER_ACCOUNT',
            statusCode: 409,
            message: 'Este endpoint Web Push já está registrado por outra conta.',
          };
        }

        // Pertence à MESMA conta: atualiza chaves, status ativo e preferências
        const hidePref =
          input.hideMedicationNames !== undefined
            ? input.hideMedicationNames
              ? 1
              : 0
            : existing.hide_medication_names;

        this.db
          .prepare(`
            UPDATE push_subscriptions
            SET p256dh = ?,
                auth = ?,
                device_name = CASE WHEN ? != '' THEN ? ELSE device_name END,
                user_agent = CASE WHEN ? != '' THEN ? ELSE user_agent END,
                hide_medication_names = ?,
                is_active = 1,
                last_seen_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ? AND account_id = ?
          `)
          .run(
            input.keys.p256dh.trim(),
            input.keys.auth.trim(),
            deviceName,
            deviceName,
            userAgent,
            userAgent,
            hidePref,
            existing.id,
            accountId
          );

        return { success: true, id: existing.id, created: false };
      } else {
        const id = 'sub_' + crypto.randomUUID();
        const hidePref = input.hideMedicationNames !== undefined ? (input.hideMedicationNames ? 1 : 0) : 1; // Default true (1)

        try {
          this.db
            .prepare(`
              INSERT INTO push_subscriptions (
                id, account_id, endpoint, p256dh, auth,
                user_agent, device_name, hide_medication_names,
                is_active, created_at, last_seen_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
            `)
            .run(
              id,
              accountId,
              input.endpoint.trim(),
              input.keys.p256dh.trim(),
              input.keys.auth.trim(),
              userAgent,
              deviceName,
              hidePref
            );

          return { success: true, id, created: true };
        } catch (insertErr: any) {
          // Caso ocorra colisão de concorrência na constraint física UNIQUE(endpoint)
          if (insertErr.code === 'SQLITE_CONSTRAINT_UNIQUE' || insertErr.message?.includes('UNIQUE constraint failed')) {
            const conflictExisting = this.db
              .prepare('SELECT id, account_id FROM push_subscriptions WHERE endpoint = ?')
              .get(input.endpoint) as { id: string; account_id: string } | undefined;

            if (conflictExisting && conflictExisting.account_id !== accountId) {
              return {
                success: false,
                error: 'ENDPOINT_OWNED_BY_ANOTHER_ACCOUNT',
                statusCode: 409,
                message: 'Este endpoint Web Push já está registrado por outra conta.',
              };
            }
          }
          throw insertErr;
        }
      }
    });

    const txResult = tx.immediate();

    if (!txResult.success) {
      return txResult;
    }

    const row = this.db
      .prepare(
        `SELECT id, device_name, user_agent, hide_medication_names, is_active, created_at, updated_at 
         FROM push_subscriptions WHERE id = ?`
      )
      .get(txResult.id);

    return {
      success: true,
      subscription: this.mapRowToPublic(row),
      created: txResult.created,
    };
  }

  /**
   * Lista as inscrições pertencentes à conta autenticada.
   * Não retorna credenciais sensíveis (chaves p256dh/auth).
   */
  listSubscriptions(accountId: string): PushSubscriptionPublic[] {
    const rows = this.db
      .prepare(`
        SELECT id, device_name, user_agent, hide_medication_names, is_active, created_at, updated_at
        FROM push_subscriptions
        WHERE account_id = ?
        ORDER BY created_at DESC
      `)
      .all(accountId);

    return rows.map((r) => this.mapRowToPublic(r));
  }

  /**
   * Consulta uma inscrição específica com validação de propriedade.
   */
  getSubscription(
    subscriptionId: string,
    accountId: string
  ): { subscription?: PushSubscriptionPublic; error?: 'NOT_FOUND' | 'FORBIDDEN' } {
    const row = this.db
      .prepare(`
        SELECT id, account_id, device_name, user_agent, hide_medication_names, is_active, created_at, updated_at
        FROM push_subscriptions
        WHERE id = ?
      `)
      .get(subscriptionId) as SubscriptionRow | undefined;

    if (!row) {
      return { error: 'NOT_FOUND' };
    }

    if (row.account_id !== accountId) {
      return { error: 'FORBIDDEN' };
    }

    return { subscription: this.mapRowToPublic(row) };
  }

  /**
   * Atualiza a preferência de privacidade (hide_medication_names) de uma subscription.
   * Valida obrigatoriamente a propriedade da conta.
   */
  updatePrivacy(
    subscriptionId: string,
    accountId: string,
    hideMedicationNames: boolean
  ): { subscription?: PushSubscriptionPublic; error?: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_INPUT' } {
    if (typeof hideMedicationNames !== 'boolean') {
      return { error: 'INVALID_INPUT' };
    }

    const existing = this.db
      .prepare('SELECT id, account_id FROM push_subscriptions WHERE id = ?')
      .get(subscriptionId) as { id: string; account_id: string } | undefined;

    if (!existing) {
      return { error: 'NOT_FOUND' };
    }

    if (existing.account_id !== accountId) {
      return { error: 'FORBIDDEN' };
    }

    this.db
      .prepare(`
        UPDATE push_subscriptions
        SET hide_medication_names = ?, updated_at = datetime('now')
        WHERE id = ? AND account_id = ?
      `)
      .run(hideMedicationNames ? 1 : 0, subscriptionId, accountId);

    const updated = this.db
      .prepare(`
        SELECT id, device_name, user_agent, hide_medication_names, is_active, created_at, updated_at
        FROM push_subscriptions
        WHERE id = ?
      `)
      .get(subscriptionId);

    return { subscription: this.mapRowToPublic(updated) };
  }

  /**
   * Desativa logicamente uma subscription (is_active = 0).
   * Preserva registro e histórico sem enviar mais notificações.
   */
  deactivateSubscription(
    subscriptionId: string,
    accountId: string
  ): { subscription?: PushSubscriptionPublic; error?: 'NOT_FOUND' | 'FORBIDDEN' } {
    const existing = this.db
      .prepare('SELECT id, account_id FROM push_subscriptions WHERE id = ?')
      .get(subscriptionId) as { id: string; account_id: string } | undefined;

    if (!existing) {
      return { error: 'NOT_FOUND' };
    }

    if (existing.account_id !== accountId) {
      return { error: 'FORBIDDEN' };
    }

    this.db
      .prepare(`
        UPDATE push_subscriptions
        SET is_active = 0, updated_at = datetime('now')
        WHERE id = ? AND account_id = ?
      `)
      .run(subscriptionId, accountId);

    const updated = this.db
      .prepare(`
        SELECT id, device_name, user_agent, hide_medication_names, is_active, created_at, updated_at
        FROM push_subscriptions
        WHERE id = ?
      `)
      .get(subscriptionId);

    return { subscription: this.mapRowToPublic(updated) };
  }

  /**
   * Remove fisicamente uma subscription caso solicitado.
   */
  removeSubscription(
    subscriptionId: string,
    accountId: string
  ): { success: boolean; error?: 'NOT_FOUND' | 'FORBIDDEN' } {
    const existing = this.db
      .prepare('SELECT id, account_id FROM push_subscriptions WHERE id = ?')
      .get(subscriptionId) as { id: string; account_id: string } | undefined;

    if (!existing) {
      return { success: false, error: 'NOT_FOUND' };
    }

    if (existing.account_id !== accountId) {
      return { success: false, error: 'FORBIDDEN' };
    }

    this.db.prepare('DELETE FROM push_subscriptions WHERE id = ? AND account_id = ?').run(subscriptionId, accountId);

    return { success: true };
  }

  /**
   * Função reutilizável para tratamento de erros retornados pelos serviços de Push (ex: FCM / Mozilla Push Service).
   * - Prioriza a identificação interna por subscriptionId (sub_<uuid>).
   * - Suporta também busca por endpoint como fallback.
   * - 404 (Not Found) e 410 (Gone): Desativa a inscrição pois o endpoint é inválido ou expirou.
   * - 5xx (Server Error): Erros temporários - mantém a inscrição para retentativa.
   * - Falhas de rede ou timeout: Mantém a inscrição para retentativa.
   */
  handlePushServiceError(
    target: PushErrorTarget,
    statusCodeOrError: number | Error | { statusCode?: number; code?: string; message?: string }
  ): PushErrorResult {
    let subscriptionId: string | undefined;
    let endpoint: string | undefined;

    if (typeof target === 'string') {
      if (target.startsWith('sub_')) {
        subscriptionId = target;
      } else {
        endpoint = target;
      }
    } else if (typeof target === 'object' && target !== null) {
      subscriptionId = target.subscriptionId;
      endpoint = target.endpoint;
    }

    let statusCode: number | undefined;

    if (typeof statusCodeOrError === 'number') {
      statusCode = statusCodeOrError;
    } else if (typeof statusCodeOrError === 'object' && statusCodeOrError !== null) {
      if ('statusCode' in statusCodeOrError && typeof statusCodeOrError.statusCode === 'number') {
        statusCode = statusCodeOrError.statusCode;
      }
    }

    // Caso terminal: 404 Not Found ou 410 Gone
    if (statusCode === 404 || statusCode === 410) {
      let affectedRows = 0;

      if (subscriptionId) {
        const result = this.db
          .prepare(`
            UPDATE push_subscriptions
            SET is_active = 0, updated_at = datetime('now')
            WHERE id = ?
          `)
          .run(subscriptionId);
        affectedRows = result.changes;
      } else if (endpoint) {
        const result = this.db
          .prepare(`
            UPDATE push_subscriptions
            SET is_active = 0, updated_at = datetime('now')
            WHERE endpoint = ?
          `)
          .run(endpoint);
        affectedRows = result.changes;
      }

      return {
        action: 'DEACTIVATED',
        reason: `Inscrição desativada após retorno HTTP ${statusCode} do serviço Web Push (dispositivo desinscrito ou endpoint expirado).`,
        affectedRows,
      };
    }

    // Erros temporários de servidor 5xx
    if (typeof statusCode === 'number' && statusCode >= 500 && statusCode < 600) {
      return {
        action: 'IGNORED',
        reason: `Erro temporário no servidor de push (HTTP ${statusCode}). Inscrição mantida ativa para retentativas.`,
        affectedRows: 0,
      };
    }

    // Timeout ou erro de conexão de rede
    const isNetworkOrTimeout =
      statusCodeOrError instanceof Error &&
      (statusCodeOrError.message.includes('timeout') ||
        statusCodeOrError.message.includes('ETIMEDOUT') ||
        statusCodeOrError.message.includes('ECONNRESET') ||
        statusCodeOrError.message.includes('ENOTFOUND') ||
        (statusCodeOrError as any).code === 'ETIMEDOUT' ||
        (statusCodeOrError as any).code === 'ECONNRESET');

    if (isNetworkOrTimeout) {
      return {
        action: 'IGNORED',
        reason: 'Falha temporária de conectividade ou timeout. Inscrição mantida ativa para retentativas.',
        affectedRows: 0,
      };
    }

    // Qualquer outro código não terminal
    return {
      action: 'IGNORED',
      reason: `Código HTTP ${statusCode ?? 'desconhecido'} não terminal. Nenhuma ação tomada.`,
      affectedRows: 0,
    };
  }
}
