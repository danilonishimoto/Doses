export interface RecurrenceValidationResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

/**
 * Validador estrito de regras de recorrência do backend Doses.
 * 
 * Formatos Efetivamente Suportados:
 * 1. Diária:
 *    - String literal 'DAILY' (normalizada para 'DAILY').
 *    - JSON estruturado com { "type": "daily" } (normalizado para 'DAILY').
 * 2. Semanal:
 *    - String compacta 'WEEKLY:d1,d2,...' (onde d são inteiros entre 0 e 7, sem duplicatas).
 *    - JSON estruturado com { "type": "weekly", "daysOfWeek": [d1, d2, ...] }
 *      (onde daysOfWeek é array não-vazio com inteiros únicos entre 0 e 7).
 * 
 * Qualquer outro formato (strings arbitrárias como 'semanal', 'diário', JSON malformado,
 * dias inexistentes ou duplicados) é rejeitado com erro explícito.
 */
export function validateRecurrence(recurrenceRaw: unknown): RecurrenceValidationResult {
  if (recurrenceRaw === undefined || recurrenceRaw === null) {
    return { valid: true, normalized: 'DAILY' };
  }

  if (typeof recurrenceRaw !== 'string') {
    return { valid: false, error: 'A recorrência deve ser uma string válida.' };
  }

  const trimmed = recurrenceRaw.trim();

  if (trimmed === '') {
    return { valid: false, error: 'A recorrência não pode ser vazia.' };
  }

  // 1. Caso Diário
  if (trimmed.toUpperCase() === 'DAILY') {
    return { valid: true, normalized: 'DAILY' };
  }

  // 2. Caso Semanal compacto: 'WEEKLY:1,3,5'
  if (trimmed.toUpperCase().startsWith('WEEKLY:')) {
    const rawDays = trimmed.slice(7).trim();
    if (!rawDays) {
      return {
        valid: false,
        error: 'Recorrência semanal compacta deve especificar ao menos um dia da semana (ex: WEEKLY:1,3,5).',
      };
    }

    const segments = rawDays.split(',');
    const days: number[] = [];
    const seen = new Set<number>();

    for (const seg of segments) {
      const cleanSeg = seg.trim();
      if (!/^[0-7]$/.test(cleanSeg)) {
        return {
          valid: false,
          error: `Dia da semana "${cleanSeg}" inválido. Dias devem ser inteiros entre 0 e 7.`,
        };
      }

      const dayNum = parseInt(cleanSeg, 10);
      if (seen.has(dayNum)) {
        return {
          valid: false,
          error: `Dia da semana "${dayNum}" duplicado na recorrência.`,
        };
      }

      seen.add(dayNum);
      days.push(dayNum);
    }

    days.sort((a, b) => a - b);
    return {
      valid: true,
      normalized: `WEEKLY:${days.join(',')}`,
    };
  }

  // 3. Caso JSON estruturado
  if (trimmed.startsWith('{')) {
    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return {
        valid: false,
        error: 'JSON de recorrência malformado.',
      };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        error: 'O JSON de recorrência deve ser um objeto estruturado.',
      };
    }

    if (!parsed.type || typeof parsed.type !== 'string') {
      return {
        valid: false,
        error: 'O campo "type" é obrigatório no JSON de recorrência.',
      };
    }

    const typeLower = parsed.type.toLowerCase();

    if (typeLower === 'daily') {
      return { valid: true, normalized: 'DAILY' };
    }

    if (typeLower === 'weekly') {
      if (!Array.isArray(parsed.daysOfWeek) || parsed.daysOfWeek.length === 0) {
        return {
          valid: false,
          error: 'Recorrência semanal em JSON exige array "daysOfWeek" com pelo menos um dia.',
        };
      }

      const days: number[] = [];
      const seen = new Set<number>();

      for (const d of parsed.daysOfWeek) {
        if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 7) {
          return {
            valid: false,
            error: `Dia da semana "${d}" inválido. Dias devem ser inteiros entre 0 e 7.`,
          };
        }

        if (seen.has(d)) {
          return {
            valid: false,
            error: `Dia da semana "${d}" duplicado no array daysOfWeek.`,
          };
        }

        seen.add(d);
        days.push(d);
      }

      days.sort((a, b) => a - b);
      return {
        valid: true,
        normalized: JSON.stringify({ type: 'weekly', daysOfWeek: days }),
      };
    }

    return {
      valid: false,
      error: `Tipo de recorrência "${parsed.type}" não suportado. Utilize "daily" ou "weekly".`,
    };
  }

  // 4. Qualquer outra string é não reconhecida e inválida
  return {
    valid: false,
    error: `Formato de recorrência "${trimmed}" não suportado. Utilize "DAILY", "WEEKLY:dias" ou JSON estruturado.`,
  };
}
