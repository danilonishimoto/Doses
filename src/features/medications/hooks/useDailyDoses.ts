import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../../services/api/apiClient';
import type { DailyMedicationItem, Profile, AvatarId } from '../../../types';
import type { Medication } from '../types/medication';
import { getMedicationRepository } from '../services';

const CARD_PALETTE = ['#BBF9E0', '#B4ECFB', '#FFF6E1', '#E8F4F1', '#FBD4EC'];

/**
 * Retorna a data atual no fuso horário 'America/Sao_Paulo' no formato 'YYYY-MM-DD'.
 */
export function getTodaySaoPauloDate(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Verifica se um medicamento está programado para ser tomado na data especificada.
 */
function isMedicationScheduledToday(med: Medication, dateStr: string): boolean {
  if (!med.recurrence || med.recurrence.type === 'daily') {
    return true;
  }

  if (med.recurrence.type === 'weekly' && Array.isArray(med.recurrence.daysOfWeek)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year!, month! - 1, day!, 12, 0, 0);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    return med.recurrence.daysOfWeek.includes(dayOfWeek) || med.recurrence.daysOfWeek.includes(isoDay);
  }

  return true;
}

interface UseDailyDosesOptions {
  activeProfile?: Profile | null;
  targetDate?: string;
}

export function useDailyDoses({ activeProfile, targetDate }: UseDailyDosesOptions) {
  const profileId = activeProfile?.id;
  const dateStr = targetDate || getTodaySaoPauloDate();

  const [doses, setDoses] = useState<DailyMedicationItem[]>([]);
  const [totalMedicationsCount, setTotalMedicationsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchDoses = useCallback(async () => {
    if (!profileId || !activeProfile) {
      if (isMountedRef.current) {
        setDoses([]);
        setTotalMedicationsCount(0);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const token = apiClient.getAccessToken();

    // 1. Tenta buscar ocorrências reais do backend
    if (token) {
      try {
        const res = await apiClient.get<{
          statusCode: number;
          date: string;
          occurrences: Array<{
            id: string;
            medicationId: string;
            medicationName: string;
            dosage: string;
            scheduledTime: string;
            status: string;
            avatar: string;
            profileName: string;
          }>;
        }>(`/profiles/${encodeURIComponent(profileId)}/occurrences?date=${encodeURIComponent(dateStr)}`);

        if (res && Array.isArray(res.occurrences)) {
          // Busca total de medicamentos cadastrados para diferenciar se o perfil não tem medicamentos ou não tem doses hoje
          let totalCount = res.occurrences.length;
          try {
            const repo = getMedicationRepository();
            const allMeds = await repo.list(profileId);
            totalCount = allMeds.length;
          } catch {
            // fallback
          }

          const mapped: DailyMedicationItem[] = res.occurrences.map((occ, idx) => ({
            id: occ.id,
            profileId,
            profileName: occ.profileName || activeProfile.name,
            avatar: (occ.avatar as AvatarId) || activeProfile.avatar,
            time: occ.scheduledTime,
            medicationName: occ.medicationName,
            dosage: occ.dosage || 'Conforme prescrição',
            status: occ.status === 'CONFIRMED' ? 'completed' : 'pending',
            cardColor: CARD_PALETTE[idx % CARD_PALETTE.length]!,
          }));

          if (isMountedRef.current) {
            setDoses(mapped);
            setTotalMedicationsCount(totalCount);
            setIsLoading(false);
          }
          return;
        }
      } catch (err: any) {
        console.warn('[useDailyDoses] Falha ao consultar backend, utilizando dados locais do IndexedDB:', err);
      }
    }

    // 2. Fallback de dados reais locais do Dexie/IndexedDB (offline first)
    try {
      const repo = getMedicationRepository();
      const localMeds = await repo.list(profileId);

      const items: DailyMedicationItem[] = [];
      let colorIdx = 0;

      // Lê status locais de doses tomadas hoje persistidos em localStorage
      const localTakenKey = `doses_taken_${profileId}_${dateStr}`;
      let takenIds: string[] = [];
      try {
        const stored = localStorage.getItem(localTakenKey);
        if (stored) takenIds = JSON.parse(stored);
      } catch {
        takenIds = [];
      }

      for (const med of localMeds) {
        if (!isMedicationScheduledToday(med, dateStr)) {
          continue;
        }

        const schedules = med.schedules && med.schedules.length > 0 ? med.schedules : ['08:00'];
        for (const time of schedules) {
          const doseId = `${med.id}_${time}_${dateStr}`;
          const isCompleted = takenIds.includes(doseId);

          items.push({
            id: doseId,
            profileId,
            profileName: activeProfile.name,
            avatar: activeProfile.avatar,
            time,
            medicationName: med.name,
            dosage: med.instructions || 'Conforme prescrição',
            status: isCompleted ? 'completed' : 'pending',
            cardColor: med.cardColor || CARD_PALETTE[colorIdx % CARD_PALETTE.length]!,
          });
          colorIdx++;
        }
      }

      // Ordena por horário crescente
      items.sort((a, b) => a.time.localeCompare(b.time));

      if (isMountedRef.current) {
        setDoses(items);
        setTotalMedicationsCount(localMeds.length);
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Falha ao carregar doses de hoje.';
        setError(msg);
        setIsLoading(false);
      }
    }
  }, [profileId, activeProfile, dateStr]);

  useEffect(() => {
    fetchDoses();
  }, [fetchDoses]);

  /**
   * Alterna status de uma dose (de pending para completed ou vice-versa) com persistência real.
   */
  const toggleDoseStatus = useCallback(
    async (doseId: string) => {
      const target = doses.find((d) => d.id === doseId);
      if (!target || !profileId) return;

      const newStatus = target.status === 'completed' ? 'pending' : 'completed';

      // Atualização otimista imediata na UI
      setDoses((prev) =>
        prev.map((d) => (d.id === doseId ? { ...d, status: newStatus } : d))
      );

      // 1. Tenta persistir no backend SQLite
      const token = apiClient.getAccessToken();

      if (token) {
        try {
          if (newStatus === 'completed') {
            await apiClient.post(
              `/profiles/${encodeURIComponent(profileId)}/occurrences/${encodeURIComponent(doseId)}/confirm`,
              { confirmedAt: new Date().toISOString() }
            );
          } else {
            await apiClient.post(
              `/profiles/${encodeURIComponent(profileId)}/occurrences/${encodeURIComponent(doseId)}/unconfirm`,
              {}
            );
          }
        } catch (err) {
          console.warn('[useDailyDoses] Backend indisponível para confirmar dose, salvando localmente:', err);
        }
      }

      // 2. Persiste estado localmente para manter coerência offline e sobreviver a recargas de página
      try {
        const localTakenKey = `doses_taken_${profileId}_${dateStr}`;
        let takenIds: string[] = [];
        const stored = localStorage.getItem(localTakenKey);
        if (stored) takenIds = JSON.parse(stored);

        if (newStatus === 'completed') {
          if (!takenIds.includes(doseId)) takenIds.push(doseId);
        } else {
          takenIds = takenIds.filter((id) => id !== doseId);
        }
        localStorage.setItem(localTakenKey, JSON.stringify(takenIds));
      } catch {
        // Ignora erro de localStorage
      }
    },
    [doses, profileId, dateStr]
  );

  return {
    doses,
    totalMedicationsCount,
    isLoading,
    error,
    refresh: fetchDoses,
    toggleDoseStatus,
  };
}
