import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getDatabase } from '../db/connection.js';
import { env } from '../config/env.js';
import { resolveWallClockToUtc } from '../utils/temporalResolver.js';
import { validateRecurrence } from '../utils/recurrenceValidator.js';

export interface TemporalConfig {
  timezone: string;
  temporalVersion: number;
}

export interface GenerateOccurrencesResult {
  generatedCount: number;
  horizonDays: number;
  timezone: string;
  temporalVersion: number;
  startDate: string;
  endDate: string;
}

export interface ScheduledSlotCandidate {
  id: string;
  medicationTimeId: string;
  profileId: string;
  accountId: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  scheduledAtUtcMs: number;
  scheduleVersion: number;
  medicationVersion: number;
  temporalVersion: number;
}

/**
 * Obtém ou reconcilia de forma transacional a configuração temporal da aplicação no SQLite.
 * 
 * Regras:
 * 1. Utiliza `app_temporal_settings` com ID fixo `'current'` como fonte de verdade persistente.
 * 2. Se a configuração não existir, inicializa com `targetTimezone` e versão 1.
 * 3. Se `targetTimezone` for idêntico ao persistido, retorna a configuração vigente.
 * 4. Se `targetTimezone` divergir da configuração persistida (ex: alteração de env.APP_TIMEZONE):
 *    - Incrementa transacionalmente `temporal_version`.
 *    - Atualiza `app_temporal_settings`.
 *    - Cancela ocorrências futuras elegíveis geradas sob o fuso anterior (status 'SCHEDULED', 'DISPATCH_FAILED'
 *      ou 'DISPATCHING' com lease expirado).
 *    - Preserva ocorrências com lease ativo ('DISPATCHING' com lease_until > now) e históricos terminais
 *      ('CONFIRMED', 'DISPATCHED', 'MISSED').
 */
export function getOrReconcileTemporalConfig(
  db: Database.Database,
  targetTimezone: string = env.APP_TIMEZONE
): TemporalConfig {
  const runTx = db.transaction(() => {
    const existing = db.prepare(`
      SELECT timezone, temporal_version
      FROM app_temporal_settings
      WHERE id = 'current'
    `).get() as { timezone: string; temporal_version: number } | undefined;

    if (!existing) {
      db.prepare(`
        INSERT INTO app_temporal_settings (id, timezone, temporal_version, updated_at)
        VALUES ('current', ?, 1, datetime('now'))
      `).run(targetTimezone);

      return { timezone: targetTimezone, temporalVersion: 1 };
    }

    if (existing.timezone === targetTimezone) {
      return { timezone: existing.timezone, temporalVersion: existing.temporal_version };
    }

    // Divergência detectada: Reconciliação necessária
    const newVersion = existing.temporal_version + 1;
    const nowMs = Date.now();

    db.prepare(`
      UPDATE app_temporal_settings
      SET timezone = ?,
          temporal_version = ?,
          updated_at = datetime('now')
      WHERE id = 'current'
    `).run(targetTimezone, newVersion);

    // Cancela ocorrências futuras elegíveis da versão temporal anterior
    db.prepare(`
      UPDATE dose_occurrences
      SET status = 'CANCELLED',
          updated_at = datetime('now')
      WHERE (
        status IN ('SCHEDULED', 'DISPATCH_FAILED')
        OR (status = 'DISPATCHING' AND (lease_until IS NULL OR lease_until <= ?))
      )
    `).run(nowMs);

    return { timezone: targetTimezone, temporalVersion: newVersion };
  });

  return runTx.immediate();
}

/**
 * Avalia se um medicamento está programado para ser tomado na data civil especificada.
 * Valida estritamente o formato de recorrência, rejeitando qualquer fallback silencioso.
 */
export function isMedicationScheduledForDate(
  recurrenceRaw: string | null | undefined,
  dateStr: string,
  timezone: string
): boolean {
  const validation = validateRecurrence(recurrenceRaw);
  if (!validation.valid) {
    throw new Error(
      `[OccurrenceGenerator] Recorrência inválida na programação: "${recurrenceRaw}". Detalhe: ${validation.error}`
    );
  }

  const normalized = validation.normalized!;
  if (normalized === 'DAILY') {
    return true;
  }

  if (normalized.startsWith('WEEKLY:')) {
    const days = normalized.slice(7).split(',').map((s) => parseInt(s, 10));
    const localDate = fromZonedTime(`${dateStr}T12:00:00`, timezone);
    const dayOfWeek = localDate.getDay();
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    return days.includes(dayOfWeek) || days.includes(isoDay);
  }

  if (normalized.startsWith('{')) {
    const parsed = JSON.parse(normalized);
    if (parsed.type === 'weekly' && Array.isArray(parsed.daysOfWeek)) {
      const localDate = fromZonedTime(`${dateStr}T12:00:00`, timezone);
      const dayOfWeek = localDate.getDay();
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      return parsed.daysOfWeek.includes(dayOfWeek) || parsed.daysOfWeek.includes(isoDay);
    }
  }

  throw new Error(`[OccurrenceGenerator] Formato de recorrência não avaliável: "${recurrenceRaw}".`);
}

export class OccurrenceGeneratorService {
  private db: Database.Database;
  private defaultTimezone: string;

  constructor(customDb?: Database.Database, customTimezone?: string) {
    this.db = customDb || getDatabase();
    this.defaultTimezone = customTimezone || env.APP_TIMEZONE;
  }

  /**
   * Retorna a configuração temporal ativa no SQLite.
   */
  getTemporalConfig(): TemporalConfig {
    return getOrReconcileTemporalConfig(this.db, this.defaultTimezone);
  }

  /**
   * Gera ocorrências futuras de forma determinística, transacional e idempotente
   * para todas as programações ativas no banco de dados.
   * 
   * @param horizonDays Quantidade de dias futuros inclusivos (padrão: 3)
   */
  generateOccurrences(horizonDays: number = 3): GenerateOccurrencesResult {
    if (horizonDays < 1 || !Number.isInteger(horizonDays)) {
      throw new Error(`horizonDays deve ser um número inteiro >= 1. Recebido: ${horizonDays}`);
    }

    // 1. Obtém a configuração temporal vigente e validada (fonte única da verdade)
    const temporalConfig = getOrReconcileTemporalConfig(this.db, this.defaultTimezone);
    const timezone = temporalConfig.timezone;
    const temporalVersion = temporalConfig.temporalVersion;

    // 2. Calcula as datas civis inclusivas do horizonte [dia 0 ... dia horizonDays-1]
    const nowUtc = new Date();
    const todayLocalStr = formatInTimeZone(nowUtc, timezone, 'yyyy-MM-dd');
    const dates: string[] = [];

    // Base ao meio-dia local para evitar qualquer oscilação de transição DST no cálculo dos dias
    const baseDate = fromZonedTime(`${todayLocalStr}T12:00:00`, timezone);

    for (let i = 0; i < horizonDays; i++) {
      const d = new Date(baseDate.getTime() + i * 24 * 3600 * 1000);
      dates.push(formatInTimeZone(d, timezone, 'yyyy-MM-dd'));
    }

    const startDate = dates[0]!;
    const endDate = dates[dates.length - 1]!;

    // 3. Lê programações ativas no banco (perfis, medicamentos e horários não excluídos)
    const activeSchedules = this.db.prepare(`
      SELECT 
        mt.id as medication_time_id,
        mt.medication_id,
        mt.profile_id,
        mt.account_id,
        mt.time as scheduled_time,
        mt.version as schedule_version,
        m.name as medication_name,
        m.recurrence,
        m.version as medication_version
      FROM medication_times mt
      JOIN medications m ON mt.medication_id = m.id AND mt.profile_id = m.profile_id AND mt.account_id = m.account_id
      JOIN profiles p ON mt.profile_id = p.id AND mt.account_id = p.account_id
      WHERE mt.is_deleted = 0
        AND m.is_deleted = 0
        AND p.is_deleted = 0
      ORDER BY mt.account_id, mt.profile_id, mt.medication_id, mt.time ASC
    `).all() as {
      medication_time_id: string;
      medication_id: string;
      profile_id: string;
      account_id: string;
      scheduled_time: string;
      schedule_version: number;
      medication_name: string;
      recurrence: string;
      medication_version: number;
    }[];

    // 4. Calcula os candidatos a ocorrência em memória (sem prender locks desnecessários de SQLite)
    const candidates: ScheduledSlotCandidate[] = [];

    for (const schedule of activeSchedules) {
      for (const dateStr of dates) {
        if (!isMedicationScheduledForDate(schedule.recurrence, dateStr, timezone)) {
          continue;
        }

        // Converte horário civil para instante UTC determinístico com suporte completo a DST
        const resolved = resolveWallClockToUtc(dateStr, schedule.scheduled_time, timezone);

        // ID determinístico SHA-256 integrando versão da programação e versão temporal
        const id = crypto
          .createHash('sha256')
          .update(
            `${schedule.medication_time_id}|${dateStr}|${schedule.scheduled_time}|${schedule.schedule_version}|${temporalVersion}`
          )
          .digest('hex');

        candidates.push({
          id,
          medicationTimeId: schedule.medication_time_id,
          profileId: schedule.profile_id,
          accountId: schedule.account_id,
          scheduledDate: dateStr,
          scheduledTime: schedule.scheduled_time,
          timezone,
          scheduledAtUtcMs: resolved.scheduledAtUtcMs,
          scheduleVersion: schedule.schedule_version,
          medicationVersion: schedule.medication_version,
          temporalVersion,
        });
      }
    }

    // 5. Persistência atômica sob transação imediata com revalidação estrita de integridade e versões
    let generatedCount = 0;

    const persistTx = this.db.transaction(() => {
      // 5.1. Revalida se a configuração temporal ainda é a mesma
      const currentConfig = this.db.prepare(`
        SELECT temporal_version, timezone FROM app_temporal_settings WHERE id = 'current'
      `).get() as { temporal_version: number; timezone: string } | undefined;

      if (!currentConfig || currentConfig.temporal_version !== temporalVersion || currentConfig.timezone !== timezone) {
        throw new Error(
          `[Concorrência] Configuração temporal modificada concorrentemente durante o cálculo. Geração abortada.`
        );
      }

      // 5.2. Prepara a inserção idempotente revalidando se as entidades ainda existem com as mesmas versões e não foram excluídas
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO dose_occurrences (
          id,
          medication_time_id,
          profile_id,
          account_id,
          scheduled_date,
          scheduled_time,
          timezone,
          scheduled_at_utc,
          schedule_version,
          temporal_version,
          status,
          created_at,
          updated_at
        )
        SELECT
          @id,
          @medicationTimeId,
          @profileId,
          @accountId,
          @scheduledDate,
          @scheduledTime,
          @timezone,
          @scheduledAtUtcMs,
          @scheduleVersion,
          @temporalVersion,
          'SCHEDULED',
          datetime('now'),
          datetime('now')
        WHERE EXISTS (
          SELECT 1 FROM medication_times mt
          JOIN medications m ON mt.medication_id = m.id AND mt.profile_id = m.profile_id AND mt.account_id = m.account_id
          JOIN profiles p ON mt.profile_id = p.id AND mt.account_id = p.account_id
          WHERE mt.id = @medicationTimeId
            AND mt.version = @scheduleVersion
            AND mt.is_deleted = 0
            AND m.version = @medicationVersion
            AND m.is_deleted = 0
            AND p.is_deleted = 0
        );
      `);

      for (const candidate of candidates) {
        const result = insertStmt.run(candidate);
        if (result.changes > 0) {
          generatedCount++;
        }
      }
    });

    persistTx();

    return {
      generatedCount,
      horizonDays,
      timezone,
      temporalVersion,
      startDate,
      endDate,
    };
  }
}
