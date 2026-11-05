import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { OccurrenceGeneratorService } from './occurrenceGeneratorService.js';
import { env } from '../config/env.js';

export interface DoseOccurrenceDto {
  id: string;
  medicationTimeId: string;
  medicationId: string;
  profileId: string;
  accountId: string;
  profileName: string;
  avatar: string;
  medicationName: string;
  dosage: string;
  recurrence: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'SCHEDULED' | 'DISPATCHING' | 'DISPATCHED' | 'DISPATCH_FAILED' | 'CONFIRMED' | 'MISSED' | 'CANCELLED';
  confirmedAt: string | null;
}

export class OccurrenceService {
  private db: Database.Database;
  private generator: OccurrenceGeneratorService;

  constructor(customDb?: Database.Database, customTimezone?: string) {
    this.db = customDb || getDatabase();
    this.generator = new OccurrenceGeneratorService(this.db, customTimezone || env.APP_TIMEZONE);
  }

  /**
   * Lista as ocorrências do perfil em uma data civil específica ('YYYY-MM-DD').
   * Executa a geração determinística e idempotente para garantir a presença dos slots.
   */
  listOccurrencesByDate(accountId: string, profileId: string, dateStr: string): DoseOccurrenceDto[] {
    // 1. Gera ocorrências para o horizonte garantindo que a data civil solicitada esteja calculada
    this.generator.generateOccurrences(7);

    // 2. Consulta as ocorrências ativas do dia no SQLite
    const rows = this.db.prepare(`
      SELECT 
        o.id,
        o.medication_time_id as medicationTimeId,
        m.id as medicationId,
        o.profile_id as profileId,
        o.account_id as accountId,
        p.name as profileName,
        p.avatar,
        m.name as medicationName,
        m.dosage,
        m.recurrence,
        o.scheduled_date as scheduledDate,
        o.scheduled_time as scheduledTime,
        o.status,
        o.confirmed_at as confirmedAt
      FROM dose_occurrences o
      JOIN medication_times mt ON o.medication_time_id = mt.id AND o.profile_id = mt.profile_id AND o.account_id = mt.account_id
      JOIN medications m ON mt.medication_id = m.id AND mt.profile_id = m.profile_id AND mt.account_id = m.account_id
      JOIN profiles p ON o.profile_id = p.id AND o.account_id = p.account_id
      WHERE o.account_id = ?
        AND o.profile_id = ?
        AND o.scheduled_date = ?
        AND o.status != 'CANCELLED'
        AND mt.is_deleted = 0
        AND m.is_deleted = 0
        AND p.is_deleted = 0
      ORDER BY o.scheduled_time ASC, m.name ASC
    `).all(accountId, profileId, dateStr) as DoseOccurrenceDto[];

    return rows;
  }

  /**
   * Confirma a tomada de uma dose para uma ocorrência específica.
   * Cria registro na tabela dose_confirmations e atualiza dose_occurrences para 'CONFIRMED'.
   */
  confirmOccurrence(
    accountId: string,
    profileId: string,
    occurrenceId: string,
    confirmedAt?: string
  ): { success: boolean; status?: string; confirmedAt?: string; error?: string } {
    const occ = this.db.prepare(`
      SELECT id, status
      FROM dose_occurrences
      WHERE id = ? AND profile_id = ? AND account_id = ? AND status != 'CANCELLED'
    `).get(occurrenceId, profileId, accountId) as { id: string; status: string } | undefined;

    if (!occ) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const timestamp = confirmedAt || new Date().toISOString();
    const confId = 'conf_' + crypto.randomUUID();

    const tx = this.db.transaction(() => {
      // 1. Registra ou atualiza dose_confirmations de forma idempotente
      this.db.prepare(`
        INSERT OR REPLACE INTO dose_confirmations (
          id, occurrence_id, profile_id, account_id, status, confirmed_at, source, created_at
        ) VALUES (
          ?, ?, ?, ?, 'TAKEN', ?, 'APP_UI', datetime('now')
        )
      `).run(confId, occurrenceId, profileId, accountId, timestamp);

      // 2. Atualiza status da ocorrência para CONFIRMED
      this.db.prepare(`
        UPDATE dose_occurrences
        SET status = 'CONFIRMED',
            confirmed_at = ?,
            updated_at = datetime('now')
        WHERE id = ? AND profile_id = ? AND account_id = ?
      `).run(timestamp, occurrenceId, profileId, accountId);
    });

    tx();

    return {
      success: true,
      status: 'CONFIRMED',
      confirmedAt: timestamp,
    };
  }

  /**
   * Desfaz a confirmação de uma dose (retorna para 'SCHEDULED').
   */
  unconfirmOccurrence(
    accountId: string,
    profileId: string,
    occurrenceId: string
  ): { success: boolean; status?: string; error?: string } {
    const occ = this.db.prepare(`
      SELECT id, status
      FROM dose_occurrences
      WHERE id = ? AND profile_id = ? AND account_id = ? AND status != 'CANCELLED'
    `).get(occurrenceId, profileId, accountId) as { id: string; status: string } | undefined;

    if (!occ) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const tx = this.db.transaction(() => {
      // 1. Remove da tabela dose_confirmations
      this.db.prepare(`
        DELETE FROM dose_confirmations
        WHERE occurrence_id = ? AND profile_id = ? AND account_id = ?
      `).run(occurrenceId, profileId, accountId);

      // 2. Reverte status da ocorrência para SCHEDULED
      this.db.prepare(`
        UPDATE dose_occurrences
        SET status = 'SCHEDULED',
            confirmed_at = NULL,
            updated_at = datetime('now')
        WHERE id = ? AND profile_id = ? AND account_id = ?
      `).run(occurrenceId, profileId, accountId);
    });

    tx();

    return {
      success: true,
      status: 'SCHEDULED',
    };
  }
}
