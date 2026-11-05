import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/api/apiClient';
import type { Profile } from '../../../types';
import { getMedicationRepository } from '../services';

export function formatDateToDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface UseMonthMedicationCountsOptions {
  activeProfile?: Profile | null;
  currentMonthDate: Date;
}

export function useMonthMedicationCounts({ activeProfile, currentMonthDate }: UseMonthMedicationCountsOptions) {
  const [countsByDate, setCountsByDate] = useState<Record<string, number>>({});
  const profileId = activeProfile?.id;
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const fetchCounts = useCallback(async () => {
    if (!profileId) {
      setCountsByDate({});
      return;
    }

    // Intervalo do mês com margem de 7 dias antes e depois para cobrir as semanas parciais do calendário
    const firstDay = new Date(year, month, 1);
    firstDay.setDate(firstDay.getDate() - 7);
    const lastDay = new Date(year, month + 1, 0);
    lastDay.setDate(lastDay.getDate() + 7);

    const startStr = formatDateToDateKey(firstDay);
    const endStr = formatDateToDateKey(lastDay);

    const token = apiClient.getAccessToken();

    // 1. Tenta buscar ocorrências reais do backend no intervalo
    if (token) {
      try {
        const res = await apiClient.get<{
          statusCode: number;
          occurrences: Array<{ scheduledDate: string }>;
        }>(`/profiles/${encodeURIComponent(profileId)}/occurrences?startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(endStr)}`);

        if (res && Array.isArray(res.occurrences)) {
          const counts: Record<string, number> = {};
          for (const occ of res.occurrences) {
            counts[occ.scheduledDate] = (counts[occ.scheduledDate] || 0) + 1;
          }
          setCountsByDate(counts);
          return;
        }
      } catch (err) {
        console.warn('[useMonthMedicationCounts] Backend offline, calculando localmente:', err);
      }
    }

    // 2. Fallback de dados reais locais do Dexie/IndexedDB
    try {
      const repo = getMedicationRepository();
      const localMeds = await repo.list(profileId);
      const counts: Record<string, number> = {};

      const cur = new Date(firstDay);
      while (cur <= lastDay) {
        const dateKey = formatDateToDateKey(cur);
        let dayCount = 0;

        for (const med of localMeds) {
          if (!med.recurrence || med.recurrence.type === 'daily') {
            dayCount += (med.schedules?.length || 1);
          } else if (med.recurrence.type === 'weekly' && Array.isArray(med.recurrence.daysOfWeek)) {
            const dayOfWeek = cur.getDay();
            const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            if (med.recurrence.daysOfWeek.includes(dayOfWeek) || med.recurrence.daysOfWeek.includes(isoDay)) {
              dayCount += (med.schedules?.length || 1);
            }
          }
        }

        if (dayCount > 0) {
          counts[dateKey] = dayCount;
        }
        cur.setDate(cur.getDate() + 1);
      }

      setCountsByDate(counts);
    } catch {
      setCountsByDate({});
    }
  }, [profileId, year, month]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const getMedicationCount = useCallback(
    (date: Date): number => {
      const key = formatDateToDateKey(date);
      return countsByDate[key] || 0;
    },
    [countsByDate]
  );

  return {
    countsByDate,
    getMedicationCount,
    refreshCounts: fetchCounts,
  };
}
