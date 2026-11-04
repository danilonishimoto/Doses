import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { getDatabase } from '../db/connection.js';
import { configureVapid, webpush } from '../config/vapid.js';
import { buildNotificationPayload } from '../utils/payloadBuilder.js';
import { SubscriptionService } from './subscriptionService.js';

export const DEFAULT_LEASE_DURATION_MS = 30_000; // 30 segundos de exclusividade por lease
export const DEFAULT_MAX_RETRIES = 3;

export interface PushDispatcherOptions {
  db?: Database.Database;
  webpushClient?: typeof webpush;
  leaseDurationMs?: number;
  maxRetries?: number;
}

export interface EligibleOccurrenceRow {
  id: string;
  medication_time_id: string;
  profile_id: string;
  account_id: string;
  scheduled_date: string;
  scheduled_time: string;
  scheduled_at_utc: number;
  schedule_version: number;
  temporal_version: number;
  status: string;
  retry_count: number;
}

export interface OccurrenceDispatchResult {
  occurrenceId: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  status?: string;
  sentCount: number;
  failedCount: number;
  expiredCount: number;
  devicesAttempted: number;
  leaseToken?: string;
}

export interface DispatchBatchResult {
  nowUtcMs: number;
  evaluatedCount: number;
  dispatchedCount: number;
  skippedCount: number;
  failedCount: number;
  totalPushSent: number;
  totalPushFailed: number;
  results: OccurrenceDispatchResult[];
}

export class PushDispatcherService {
  private db: Database.Database;
  private webpushClient: typeof webpush;
  private subscriptionService: SubscriptionService;
  private leaseDurationMs: number;
  private maxRetries: number;

  constructor(options?: PushDispatcherOptions) {
    this.db = options?.db || getDatabase();
    this.webpushClient = options?.webpushClient || webpush;
    this.subscriptionService = new SubscriptionService(this.db);
    this.leaseDurationMs = options?.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Identifica e processa todas as ocorrências elegíveis para envio no instante atual.
   * Não executa loops contínuos; processa o lote pontual e retorna o relatório estruturado.
   */
  async dispatchEligibleOccurrences(options?: {
    nowUtcMs?: number;
    limit?: number;
  }): Promise<DispatchBatchResult> {
    const nowUtcMs = options?.nowUtcMs ?? Date.now();
    const limit = options?.limit ?? 50;

    // 1. Busca ocorrências elegíveis com scheduled_at_utc <= nowUtcMs
    const eligibleRows = this.db
      .prepare(`
        SELECT 
          id, medication_time_id, profile_id, account_id,
          scheduled_date, scheduled_time, scheduled_at_utc,
          schedule_version, temporal_version, status, retry_count
        FROM dose_occurrences
        WHERE scheduled_at_utc <= :nowUtcMs
          AND retry_count < :maxRetries
          AND (
            status = 'SCHEDULED'
            OR (status = 'DISPATCHING' AND lease_until < :nowUtcMs)
            OR status = 'DISPATCH_FAILED'
          )
        ORDER BY scheduled_at_utc ASC
        LIMIT :limit
      `)
      .all({ nowUtcMs, maxRetries: this.maxRetries, limit }) as EligibleOccurrenceRow[];

    const results: OccurrenceDispatchResult[] = [];
    let dispatchedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalPushSent = 0;
    let totalPushFailed = 0;

    for (const row of eligibleRows) {
      const res = await this.dispatchOccurrence(row, nowUtcMs);
      results.push(res);

      if (res.skipped) {
        skippedCount++;
      } else if (res.success) {
        dispatchedCount++;
      } else {
        failedCount++;
      }

      totalPushSent += res.sentCount;
      totalPushFailed += res.failedCount;
    }

    return {
      nowUtcMs,
      evaluatedCount: eligibleRows.length,
      dispatchedCount,
      skippedCount,
      failedCount,
      totalPushSent,
      totalPushFailed,
      results,
    };
  }

  /**
   * Processa uma única ocorrência específica:
   * 1. Valida deduplicação lógica de slot civil entre versões.
   * 2. Adquire lease atômico com lease_token único e BEGIN IMMEDIATE.
   * 3. Envia Web Push para todos os dispositivos ativos da conta.
   * 4. Registra resultado por dispositivo em dose_occurrence_dispatches.
   * 5. Finaliza ocorrência garantindo correspondência do lease_token.
   */
  async dispatchOccurrence(
    occurrenceIdOrRow: string | EligibleOccurrenceRow,
    customNowUtcMs?: number
  ): Promise<OccurrenceDispatchResult> {
    const nowUtcMs = customNowUtcMs ?? Date.now();
    const occurrenceId =
      typeof occurrenceIdOrRow === 'string' ? occurrenceIdOrRow : occurrenceIdOrRow.id;

    // --------------------------------------------------------------------------
    // 1. AQUISIÇÃO ATÔMICA DO LEASE COM DEDUPLICAÇÃO LÓGICA ENTRE VERSÕES
    // --------------------------------------------------------------------------
    const leaseToken = crypto.randomUUID();
    const leaseUntil = nowUtcMs + this.leaseDurationMs;

    const acquireTx = this.db.transaction(() => {
      // 1.1 Obtém a ocorrência alvo
      const target = this.db
        .prepare(`
          SELECT id, medication_time_id, profile_id, account_id,
                 scheduled_date, scheduled_time, scheduled_at_utc,
                 schedule_version, temporal_version, status, retry_count
          FROM dose_occurrences
          WHERE id = ?
        `)
        .get(occurrenceId) as EligibleOccurrenceRow | undefined;

      if (!target) {
        return { acquired: false, skipped: true, reason: 'OCCURRENCE_NOT_FOUND' };
      }

      // 1.2 Regra de Deduplicação Lógica (Seção 2.3):
      // Verifica se já existe uma ocorrência para o mesmo slot civil (medication_time_id + scheduled_date + scheduled_time)
      // que já tenha sido DISPATCHED ou CONFIRMED (seja de versão de agendamento ou temporal anterior/posterior)
      const completedDup = this.db
        .prepare(`
          SELECT id, status, schedule_version, temporal_version
          FROM dose_occurrences
          WHERE medication_time_id = :medicationTimeId
            AND scheduled_date = :scheduledDate
            AND scheduled_time = :scheduledTime
            AND id != :occurrenceId
            AND status IN ('DISPATCHED', 'CONFIRMED')
          LIMIT 1
        `)
        .get({
          medicationTimeId: target.medication_time_id,
          scheduledDate: target.scheduled_date,
          scheduledTime: target.scheduled_time,
          occurrenceId: target.id,
        }) as { id: string; status: string; schedule_version: number; temporal_version: number } | undefined;

      if (completedDup) {
        // O slot clínico já foi atendido por outra versão!
        // Cancela esta ocorrência redundante de forma segura, preservando o histórico.
        this.db
          .prepare(`
            UPDATE dose_occurrences
            SET status = 'CANCELLED',
                last_error = 'SUPERSEDED_SLOT_ALREADY_' || :dupStatus,
                updated_at = datetime('now')
            WHERE id = :occurrenceId
              AND status IN ('SCHEDULED', 'DISPATCH_FAILED')
          `)
          .run({ occurrenceId: target.id, dupStatus: completedDup.status });

        return {
          acquired: false,
          skipped: true,
          reason: `SUPERSEDED_SLOT_ALREADY_${completedDup.status}`,
        };
      }

      // 1.3 Verifica se outro worker está despachando uma versão equivalente agora
      const activeDup = this.db
        .prepare(`
          SELECT id FROM dose_occurrences
          WHERE medication_time_id = :medicationTimeId
            AND scheduled_date = :scheduledDate
            AND scheduled_time = :scheduledTime
            AND id != :occurrenceId
            AND status = 'DISPATCHING'
            AND lease_until >= :nowUtcMs
          LIMIT 1
        `)
        .get({
          medicationTimeId: target.medication_time_id,
          scheduledDate: target.scheduled_date,
          scheduledTime: target.scheduled_time,
          occurrenceId: target.id,
          nowUtcMs,
        });

      if (activeDup) {
        return {
          acquired: false,
          skipped: true,
          reason: 'EQUIVALENT_SLOT_CURRENTLY_DISPATCHING',
        };
      }

      // 1.4 Adquire o lease atômico com incremento de retry_count
      const acquireResult = this.db
        .prepare(`
          UPDATE dose_occurrences
          SET status = 'DISPATCHING',
              lease_until = :leaseUntil,
              lease_token = :leaseToken,
              retry_count = retry_count + 1,
              updated_at = datetime('now')
          WHERE id = :occurrenceId
            AND retry_count < :maxRetries
            AND (
              status = 'SCHEDULED'
              OR (status = 'DISPATCHING' AND lease_until < :nowUtcMs)
              OR status = 'DISPATCH_FAILED'
            )
        `)
        .run({
          occurrenceId: target.id,
          leaseUntil,
          leaseToken,
          maxRetries: this.maxRetries,
          nowUtcMs,
        });

      if (acquireResult.changes === 1) {
        return { acquired: true, skipped: false, target, leaseToken };
      }

      return { acquired: false, skipped: true, reason: 'LEASE_ACQUISITION_FAILED' };
    });

    const acquisition = acquireTx.immediate();

    if (!acquisition.acquired) {
      return {
        occurrenceId,
        success: false,
        skipped: true,
        reason: acquisition.reason,
        sentCount: 0,
        failedCount: 0,
        expiredCount: 0,
        devicesAttempted: 0,
      };
    }

    // --------------------------------------------------------------------------
    // 2. BUSCA DE DADOS CLÍNICOS E SUBSCRIPTIONS ATIVAS DA CONTA
    // --------------------------------------------------------------------------
    const occurrenceData = this.db
      .prepare(`
        SELECT 
          o.id as occurrence_id,
          o.account_id,
          o.profile_id,
          o.scheduled_time,
          p.name as profile_name,
          m.name as medication_name,
          m.dosage
        FROM dose_occurrences o
        LEFT JOIN profiles p ON o.profile_id = p.id AND o.account_id = p.account_id
        LEFT JOIN medication_times mt ON o.medication_time_id = mt.id AND o.profile_id = mt.profile_id AND o.account_id = mt.account_id
        LEFT JOIN medications m ON mt.medication_id = m.id AND mt.profile_id = m.profile_id AND mt.account_id = m.account_id
        WHERE o.id = ?
      `)
      .get(occurrenceId) as {
      occurrence_id: string;
      account_id: string;
      profile_id: string;
      scheduled_time: string;
      profile_name: string | null;
      medication_name: string | null;
      dosage: string | null;
    };

    // Subscriptions pertencem à conta (Regra 2.4: todas as ativas devem ser notificadas)
    const activeSubs = this.db
      .prepare(`
        SELECT id, endpoint, p256dh, auth, device_name, hide_medication_names
        FROM push_subscriptions
        WHERE account_id = ?
          AND is_active = 1
      `)
      .all(occurrenceData.account_id) as {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      device_name: string;
      hide_medication_names: number;
    }[];

    // Caso de borda (Cenário 2): Conta sem nenhuma subscription ativa cadastrada
    if (activeSubs.length === 0) {
      this.db
        .prepare(`
          UPDATE dose_occurrences
          SET status = 'DISPATCHED',
              dispatched_at = datetime('now'),
              lease_until = NULL,
              last_error = 'NO_ACTIVE_SUBSCRIPTIONS',
              updated_at = datetime('now')
          WHERE id = :occurrenceId
            AND lease_token = :leaseToken
            AND status = 'DISPATCHING'
        `)
        .run({ occurrenceId, leaseToken });

      return {
        occurrenceId,
        success: true,
        status: 'DISPATCHED',
        reason: 'NO_ACTIVE_SUBSCRIPTIONS',
        sentCount: 0,
        failedCount: 0,
        expiredCount: 0,
        devicesAttempted: 0,
        leaseToken,
      };
    }

    // --------------------------------------------------------------------------
    // 3. ENVIO INDIVIDUALIZADO POR DISPOSITIVO (COM RESGUARDO CONTRA RE-ENVIOS)
    // --------------------------------------------------------------------------
    // Dispositivos que já tiveram sucesso registrado nesta ocorrência (em tentativa prévia)
    const alreadySentRows = this.db
      .prepare(`
        SELECT subscription_id FROM dose_occurrence_dispatches
        WHERE occurrence_id = ? AND status = 'SENT'
      `)
      .all(occurrenceId) as { subscription_id: string }[];
    const alreadySentSet = new Set(alreadySentRows.map((r) => r.subscription_id));

    const pendingSubs = activeSubs.filter((s) => !alreadySentSet.has(s.id));

    let sentCount = alreadySentSet.size; // Já entregues em tentativas passadas
    let failedCount = 0;
    let expiredCount = 0;
    let newlySentCount = 0;
    let lastTransientError: string | null = null;

    for (const sub of pendingSubs) {
      // Constrói o payload individualizado respeitando a preferência de privacidade do dispositivo
      const payload = buildNotificationPayload({
        occurrenceId,
        scheduledTime: occurrenceData.scheduled_time,
        profileId: occurrenceData.profile_id,
        profileName: occurrenceData.profile_name || 'Paciente',
        medicationName: occurrenceData.medication_name || 'Medicamento',
        dosage: occurrenceData.dosage || '',
        hideMedicationNames: sub.hide_medication_names,
      });

      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        tag: `dose-${occurrenceId}`, // Tag única que colapsa notificações duplicadas no navegador
      });

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        const sendResponse = await this.webpushClient.sendNotification(
          pushSubscription,
          pushPayload,
          {
            urgency: 'high',
            TTL: 3600,
            topic: `dose-${occurrenceId.slice(0, 27)}`,
          }
        );

        const statusCode = (sendResponse && sendResponse.statusCode) || 201;

        // Registra o sucesso do dispositivo
        this.recordDeviceDispatch({
          occurrenceId,
          subscriptionId: sub.id,
          accountId: occurrenceData.account_id,
          deviceName: sub.device_name,
          status: 'SENT',
          statusCode,
        });

        newlySentCount++;
        sentCount++;
      } catch (err: any) {
        const statusCode = err.statusCode || (err.response && err.response.statusCode);
        const errorMessage = err.message || 'Falha desconhecida no envio Push';

        this.recordDeviceDispatch({
          occurrenceId,
          subscriptionId: sub.id,
          accountId: occurrenceData.account_id,
          deviceName: sub.device_name,
          status: 'FAILED',
          statusCode,
          errorMessage,
        });

        // Caso terminal: 404 Not Found ou 410 Gone (Subscription inválida/expirada no push service)
        if (statusCode === 404 || statusCode === 410) {
          this.subscriptionService.handlePushServiceError(sub.id, statusCode);
          expiredCount++;
        } else {
          failedCount++;
          lastTransientError = errorMessage;
        }
      }
    }

    // --------------------------------------------------------------------------
    // 4. FINALIZAÇÃO ATÔMICA DA OCORRÊNCIA COM VALIDAÇÃO DE LEASE_TOKEN
    // --------------------------------------------------------------------------
    const currentOccurrence = this.db
      .prepare('SELECT retry_count FROM dose_occurrences WHERE id = ?')
      .get(occurrenceId) as { retry_count: number } | undefined;

    const currentRetries = currentOccurrence ? currentOccurrence.retry_count : this.maxRetries;

    let finalStatus: 'DISPATCHED' | 'DISPATCH_FAILED' | 'MISSED' = 'DISPATCHED';
    let finalError: string | null = null;

    if (failedCount === 0) {
      // Sucesso total: todos os dispositivos ativos receberam (ou foram desativados por 404/410)
      finalStatus = 'DISPATCHED';
      finalError = null;
    } else {
      // Pelo menos um dispositivo sofreu falha transitória
      if (currentRetries < this.maxRetries) {
        finalStatus = 'DISPATCH_FAILED';
        finalError = lastTransientError || 'FALHA_TRANSITORIA_WEB_PUSH';
      } else {
        // Esgotou tentativas máximas
        if (sentCount > 0) {
          // Entrega parcial: pelo menos um dispositivo recebeu com sucesso
          finalStatus = 'DISPATCHED';
          finalError = `PARTIAL_DELIVERY_MAX_RETRIES: ${failedCount} dispositivos falharam. ${lastTransientError}`;
        } else {
          // Nenhum dispositivo recebeu e retries esgotaram
          finalStatus = 'MISSED';
          finalError = `MAX_RETRIES_EXCEEDED: ${lastTransientError}`;
        }
      }
    }

    // Transição final: exige estritamente lease_token e status = 'DISPATCHING'
    const finalizeResult = this.db
      .prepare(`
        UPDATE dose_occurrences
        SET status = :finalStatus,
            dispatched_at = CASE WHEN :finalStatus = 'DISPATCHED' THEN datetime('now') ELSE dispatched_at END,
            lease_until = NULL,
            last_error = :finalError,
            updated_at = datetime('now')
        WHERE id = :occurrenceId
          AND lease_token = :leaseToken
          AND status = 'DISPATCHING'
      `)
      .run({
        occurrenceId,
        leaseToken,
        finalStatus,
        finalError,
      });

    const isLeaseOwner = finalizeResult.changes === 1;

    return {
      occurrenceId,
      success: isLeaseOwner && finalStatus === 'DISPATCHED',
      status: finalStatus,
      sentCount: newlySentCount,
      failedCount,
      expiredCount,
      devicesAttempted: pendingSubs.length,
      leaseToken,
      reason: isLeaseOwner ? finalError || undefined : 'LEASE_LOST_DURING_EXECUTION',
    };
  }

  private recordDeviceDispatch(data: {
    occurrenceId: string;
    subscriptionId: string;
    accountId: string;
    deviceName: string;
    status: 'SENT' | 'FAILED';
    statusCode?: number;
    errorMessage?: string;
  }): void {
    const dispatchId = `disp_${crypto.randomUUID()}`;
    this.db
      .prepare(`
        INSERT INTO dose_occurrence_dispatches (
          id, occurrence_id, subscription_id, account_id, device_name,
          status, status_code, error_message, sent_at, updated_at
        ) VALUES (
          :id, :occurrenceId, :subscriptionId, :accountId, :deviceName,
          :status, :statusCode, :errorMessage,
          CASE WHEN :status = 'SENT' THEN datetime('now') ELSE NULL END,
          datetime('now')
        )
        ON CONFLICT(occurrence_id, subscription_id) DO UPDATE SET
          status = excluded.status,
          status_code = excluded.status_code,
          error_message = excluded.error_message,
          attempt_count = attempt_count + 1,
          sent_at = CASE WHEN excluded.status = 'SENT' THEN datetime('now') ELSE sent_at END,
          updated_at = datetime('now')
      `)
      .run({
        id: dispatchId,
        occurrenceId: data.occurrenceId,
        subscriptionId: data.subscriptionId,
        accountId: data.accountId,
        deviceName: data.deviceName || '',
        status: data.status,
        statusCode: data.statusCode || null,
        errorMessage: data.errorMessage || null,
      });
  }
}
