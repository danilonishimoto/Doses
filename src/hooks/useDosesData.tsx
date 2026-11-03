import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  AppSettings,
  DoseLog,
  DoseStatus,
  DosesDatabaseSchema,
  Medication,
  Profile,
} from '../types';
import { storageService } from '../services/storageService';
import { getCurrentTimeHHMM } from './../utils/dateUtils';

interface DosesContextValue {
  profiles: Profile[];
  medications: Medication[];
  doseLogs: DoseLog[];
  settings: AppSettings;
  pendingSync: boolean;
  lastUpdatedAt: string;
  activeProfileFilter: string | 'all';
  setActiveProfileFilter: (profileId: string | 'all') => void;
  updateDoseStatus: (doseId: string, status: DoseStatus, notes?: string) => void;
  addMedication: (medication: Omit<Medication, 'id'>) => void;
  toggleMedicationActive: (medicationId: string) => void;
  addProfile: (profile: Omit<Profile, 'id'>) => void;
  updateSettings: (partialSettings: Partial<AppSettings>) => void;
  resetDemoData: () => void;
  toastMessage: string | null;
  dismissToast: () => void;
  triggerToast: (message: string) => void;
}

const DosesContext = createContext<DosesContextValue | undefined>(undefined);

export function DosesProvider({ children }: { children: ReactNode }) {
  const [envelope, setEnvelope] = useState(() => storageService.loadDatabase());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 4000);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const commitChange = useCallback(
    (updater: (prev: DosesDatabaseSchema) => DosesDatabaseSchema, feedbackMessage?: string) => {
      setEnvelope((prevEnvelope) => {
        const nextData = updater(prevEnvelope.data);
        return storageService.saveDatabase(nextData, true);
      });
      if (feedbackMessage) {
        triggerToast(feedbackMessage);
      }
    },
    [triggerToast]
  );

  const setActiveProfileFilter = useCallback(
    (profileId: string | 'all') => {
      commitChange((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          activeProfileFilter: profileId,
        },
      }));
    },
    [commitChange]
  );

  const updateDoseStatus = useCallback(
    (doseId: string, status: DoseStatus, notes?: string) => {
      const timeNow = getCurrentTimeHHMM();
      commitChange(
        (prev) => ({
          ...prev,
          doseLogs: prev.doseLogs.map((log) => {
            if (log.id !== doseId) return log;
            return {
              ...log,
              status,
              administeredAt: status === 'administered' ? timeNow : undefined,
              administeredBy: status !== 'pending' ? 'Helena Costa' : undefined,
              notes: notes !== undefined ? notes : log.notes,
            };
          }),
        }),
        status === 'administered'
          ? `Dose registrada como administrada às ${timeNow}.`
          : status === 'pending'
            ? 'Registro de dose retornado para pendente.'
            : 'Status da dose atualizado no histórico.'
      );
    },
    [commitChange]
  );

  const addMedication = useCallback(
    (newMed: Omit<Medication, 'id'>) => {
      const id = `med-${Date.now()}`;
      commitChange(
        (prev) => ({
          ...prev,
          medications: [{ ...newMed, id }, ...prev.medications],
        }),
        `Medicamento "${newMed.name}" cadastrado com sucesso.`
      );
    },
    [commitChange]
  );

  const toggleMedicationActive = useCallback(
    (medicationId: string) => {
      commitChange(
        (prev) => ({
          ...prev,
          medications: prev.medications.map((med) =>
            med.id === medicationId ? { ...med, active: !med.active } : med
          ),
        }),
        'Status do tratamento atualizado.'
      );
    },
    [commitChange]
  );

  const addProfile = useCallback(
    (newProfile: Omit<Profile, 'id'>) => {
      const id = `prof-${Date.now()}`;
      commitChange(
        (prev) => ({
          ...prev,
          profiles: [...prev.profiles, { ...newProfile, id }],
        }),
        `Perfil "${newProfile.name}" adicionado ao acompanhamento.`
      );
    },
    [commitChange]
  );

  const updateSettings = useCallback(
    (partialSettings: Partial<AppSettings>) => {
      commitChange(
        (prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            ...partialSettings,
            notifications: {
              ...prev.settings.notifications,
              ...(partialSettings.notifications || {}),
            },
          },
        }),
        'Preferências atualizadas e salvas no dispositivo.'
      );
    },
    [commitChange]
  );

  const resetDemoData = useCallback(() => {
    const freshEnvelope = storageService.resetToInitialData();
    setEnvelope(freshEnvelope);
    triggerToast('Dados de demonstração restaurados para o estado inicial.');
  }, [triggerToast]);

  return (
    <DosesContext.Provider
      value={{
        profiles: envelope.data.profiles,
        medications: envelope.data.medications,
        doseLogs: envelope.data.doseLogs,
        settings: envelope.data.settings,
        pendingSync: envelope.pendingSync,
        lastUpdatedAt: envelope.updatedAt,
        activeProfileFilter: envelope.data.settings.activeProfileFilter,
        setActiveProfileFilter,
        updateDoseStatus,
        addMedication,
        toggleMedicationActive,
        addProfile,
        updateSettings,
        resetDemoData,
        toastMessage,
        dismissToast,
        triggerToast,
      }}
    >
      {children}
    </DosesContext.Provider>
  );
}

export function useDoses(): DosesContextValue {
  const context = useContext(DosesContext);
  if (!context) {
    throw new Error('useDoses deve ser utilizado dentro de um DosesProvider.');
  }
  return context;
}
