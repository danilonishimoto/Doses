import initialDataRaw from '../data/initialData.json';
import { DosesDatabaseSchema, SyncEnvelope } from '../types';
import { getTodayISO, getYesterdayISO } from '../utils/dateUtils';

const STORAGE_KEY = 'doses_app_db_v1';
const SCHEMA_VERSION = 1;

function hydrateDynamicDates(raw: DosesDatabaseSchema): DosesDatabaseSchema {
  const today = getTodayISO();
  const yesterday = getYesterdayISO();

  return {
    ...raw,
    doseLogs: raw.doseLogs.map((log) => ({
      ...log,
      scheduledDate:
        log.scheduledDate === 'TODAY'
          ? today
          : log.scheduledDate === 'YESTERDAY'
            ? yesterday
            : log.scheduledDate,
    })),
    settings: {
      ...raw.settings,
      lastLocalSyncAt:
        raw.settings.lastLocalSyncAt === 'NOW'
          ? new Date().toISOString()
          : raw.settings.lastLocalSyncAt,
    },
  };
}

export const storageService = {
  loadDatabase(): SyncEnvelope<DosesDatabaseSchema> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SyncEnvelope<DosesDatabaseSchema>;
        if (parsed && parsed.data && parsed.version === SCHEMA_VERSION) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Falha ao ler cache local do Doses, restaurando dados padrão.', error);
    }

    const hydrated = hydrateDynamicDates(initialDataRaw as unknown as DosesDatabaseSchema);
    const initialEnvelope: SyncEnvelope<DosesDatabaseSchema> = {
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      pendingSync: false,
      data: hydrated,
    };

    this.saveDatabase(hydrated, false);
    return initialEnvelope;
  },

  saveDatabase(data: DosesDatabaseSchema, markPendingSync = true): SyncEnvelope<DosesDatabaseSchema> {
    const envelope: SyncEnvelope<DosesDatabaseSchema> = {
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      pendingSync: markPendingSync,
      data: {
        ...data,
        settings: {
          ...data.settings,
          lastLocalSyncAt: new Date().toISOString(),
        },
      },
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch (error) {
      console.error('Erro ao salvar dados localmente:', error);
    }

    return envelope;
  },

  resetToInitialData(): SyncEnvelope<DosesDatabaseSchema> {
    localStorage.removeItem(STORAGE_KEY);
    return this.loadDatabase();
  },

  exportDatabaseJSON(data: DosesDatabaseSchema): string {
    return JSON.stringify(data, null, 2);
  },
};
