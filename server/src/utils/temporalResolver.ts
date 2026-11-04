import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export interface ResolvedWallClock {
  /** Instante UTC exato resolvido como Date */
  utcDate: Date;
  /** Instante UTC em string ISO 8601 (ex: '2026-03-08T07:00:00.000Z') */
  utcIso: string;
  /** Instante UTC em época Unix (milissegundos) */
  scheduledAtUtcMs: number;
  /** Horário civil local efetivamente resolvido ('YYYY-MM-DDTHH:mm:ss') */
  resolvedCivil: string;
  /** Identificação se o horário existia exatamente ou foi resolvido de um gap DST */
  type: 'EXACT_OR_FIRST_AMBIGUOUS' | 'GAP_RESOLVED';
  /** Total de iterações executadas (0 para horários existentes/ambíguos) */
  iterations: number;
}

/**
 * Converte data civil ('YYYY-MM-DD') e horário civil ('HH:mm') em um instante UTC determinístico
 * sob a semântica de relógio de parede (wall-clock time), tratando de forma matematicamente
 * rigorosa as descontinuidades de Horário de Verão (DST) e mudanças de fuso horário.
 * 
 * Regras e Invariantes:
 * 1. Horário Exato / Ambíguo (Overlap / Fall Back):
 *    - Se o horário civil existe no fuso, retorna imediatamente (0 iterações).
 *    - Se o horário for ambíguo (repetido no retorno do DST), seleciona deterministicamente
 *      a primeira ocorrência UTC retornada por `fromZonedTime`.
 * 2. Horário Inexistente (Gap / Spring Forward):
 *    - O horário local não existe no fuso civil.
 *    - Utiliza Busca Galopante (Galloping/Exponential Search) para delimitar o intervalo [low, high]
 *      satisfazendo estritamente a invariante: civil(low) < targetStr <= civil(high).
 *      Isso elimina limites mágicos fixos (como 3h), suportando desde saltos de 30m até saltos
 *      históricos de 24h (ex: Samoa 2011).
 *    - Executa Bisseção Discreta por Segundos Inteiros sobre o domínio [low, high].
 *      Como o degrau de transição no avanço do relógio é descontínuo positivo (para cima),
 *      a monotonicidade do predicado civil(t) >= targetStr é matematicamente garantida.
 *    - Retorna exatamente o primeiro segundo civil válido pós-transição.
 */
export function resolveWallClockToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string
): ResolvedWallClock {
  const targetStr = `${dateStr}T${timeStr}:00`;
  const initialUtc = fromZonedTime(targetStr, timezone);
  const initialCivil = formatInTimeZone(initialUtc, timezone, "yyyy-MM-dd'T'HH:mm:ss");

  // Caso 1: Horário civil válido exatamente ou primeira ocorrência em overlap ambíguo
  if (initialCivil === targetStr) {
    return {
      utcDate: initialUtc,
      utcIso: initialUtc.toISOString(),
      scheduledAtUtcMs: initialUtc.getTime(),
      resolvedCivil: initialCivil,
      type: 'EXACT_OR_FIRST_AMBIGUOUS',
      iterations: 0,
    };
  }

  // Caso 2: Gap (avanço do relógio / DST forward jump)
  // 2.1. Busca Galopante para descoberta dinâmica do delimitador superior [low, high]
  const initialLow = Math.floor(initialUtc.getTime() / 1000);
  let low = initialLow;
  let step = 3600; // Passo inicial de 1 hora
  let high = low + step;
  let iterations = 0;
  const MAX_CUMULATIVE_OFFSET_SECONDS = 48 * 3600; // Teto operacional estrito: 48 horas de deslocamento acumulado

  while (true) {
    iterations++;
    const civilHigh = formatInTimeZone(new Date(high * 1000), timezone, "yyyy-MM-dd'T'HH:mm:ss");
    if (civilHigh >= targetStr) {
      // Invariante satisfeita: civil(low) < targetStr <= civil(high)
      break;
    }
    low = high;
    step *= 2;
    high = low + step;

    // Garante que o deslocamento cumulativo total (high - initialLow) nunca ultrapasse 48 horas
    if (high - initialLow > MAX_CUMULATIVE_OFFSET_SECONDS) {
      high = initialLow + MAX_CUMULATIVE_OFFSET_SECONDS;

      if (low >= high) {
        throw new Error(
          `[TemporalResolver] Impossível delimitar intervalo para ${targetStr} no fuso ${timezone}: deslocamento acumulado excede teto de 48h.`
        );
      }

      iterations++;
      const civilMax = formatInTimeZone(new Date(high * 1000), timezone, "yyyy-MM-dd'T'HH:mm:ss");
      if (civilMax >= targetStr) {
        break; // Delimitado exatamente no teto de 48h
      }

      throw new Error(
        `[TemporalResolver] Impossível delimitar intervalo para ${targetStr} no fuso ${timezone}: deslocamento acumulado excede teto de 48h.`
      );
    }
  }

  // 2.2. Bisseção discreta em segundos inteiros
  while (low < high) {
    iterations++;
    const mid = Math.floor((low + high) / 2);
    const civilMid = formatInTimeZone(new Date(mid * 1000), timezone, "yyyy-MM-dd'T'HH:mm:ss");

    if (civilMid < targetStr) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const finalDate = new Date(low * 1000);
  const resolvedCivil = formatInTimeZone(finalDate, timezone, "yyyy-MM-dd'T'HH:mm:ss");

  return {
    utcDate: finalDate,
    utcIso: finalDate.toISOString(),
    scheduledAtUtcMs: finalDate.getTime(),
    resolvedCivil,
    type: 'GAP_RESOLVED',
    iterations,
  };
}
