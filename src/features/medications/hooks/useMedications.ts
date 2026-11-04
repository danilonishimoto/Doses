import { useState, useEffect, useCallback, useRef } from 'react';
import type { CreateMedicationDTO, Medication, UpdateMedicationDTO } from '../types/medication';
import { getMedicationRepository } from '../services';

interface UseMedicationsOptions {
  profileId?: string;
  autoFetch?: boolean;
}

export function useMedications(options: UseMedicationsOptions = {}) {
  const { profileId, autoFetch = true } = options;
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchMedications = useCallback(async () => {
    if (!profileId) {
      setMedications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const repository = getMedicationRepository();
      const data = await repository.list(profileId);
      if (isMountedRef.current) {
        setMedications(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar medicamentos';
        setError(msg);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [profileId]);

  useEffect(() => {
    if (autoFetch && profileId) {
      fetchMedications();
    } else if (!profileId) {
      setMedications([]);
    }
  }, [autoFetch, profileId, fetchMedications]);

  const createMedication = useCallback(
    async (data: Omit<CreateMedicationDTO, 'profileId'>): Promise<Medication> => {
      if (!profileId) {
        throw new Error('Nenhum perfil ativo selecionado para cadastrar o medicamento.');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const repository = getMedicationRepository();
        const created = await repository.create({
          ...data,
          profileId,
        });

        if (isMountedRef.current) {
          setMedications((prev) => [...prev, created]);
        }
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao cadastrar medicamento';
        if (isMountedRef.current) {
          setError(msg);
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [profileId]
  );

  const updateMedication = useCallback(
    async (id: string, data: UpdateMedicationDTO): Promise<Medication> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const repository = getMedicationRepository();
        const updated = await repository.update(id, data);

        if (isMountedRef.current) {
          setMedications((prev) => prev.map((m) => (m.id === id ? updated : m)));
        }
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao atualizar medicamento';
        if (isMountedRef.current) {
          setError(msg);
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    []
  );

  const deleteMedication = useCallback(async (id: string): Promise<void> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const repository = getMedicationRepository();
      await repository.delete(id);

      if (isMountedRef.current) {
        setMedications((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir medicamento';
      if (isMountedRef.current) {
        setError(msg);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    medications,
    isLoading,
    isSubmitting,
    error,
    refresh: fetchMedications,
    createMedication,
    updateMedication,
    deleteMedication,
    clearError,
  };
}
