import type { MedicationRepository } from './medicationRepository';
import { MockMedicationRepository } from './mockMedicationRepository';
import { ApiMedicationRepository } from './apiMedicationRepository';

export type RepositoryDataSource = 'mock' | 'api';

// Ponto de configuração: por padrão utiliza 'api' para persistência real e sincronização
export const MEDICATION_REPOSITORY_CONFIG = {
  dataSource: ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_MEDICATION_DATA_SOURCE) || 'api') as RepositoryDataSource,
  apiUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1',
  mockLatencyMs: 200,
};

let activeRepositoryInstance: MedicationRepository | null = null;
let activeMockInstance: MockMedicationRepository | null = null;

/**
 * Retorna a instância ativa do repositório conforme a configuração.
 */
export function getMedicationRepository(): MedicationRepository {
  if (!activeRepositoryInstance) {
    if (MEDICATION_REPOSITORY_CONFIG.dataSource === 'api') {
      activeRepositoryInstance = new ApiMedicationRepository({
        baseUrl: MEDICATION_REPOSITORY_CONFIG.apiUrl,
      });
    } else {
      activeMockInstance = new MockMedicationRepository(
        undefined,
        MEDICATION_REPOSITORY_CONFIG.mockLatencyMs
      );
      activeRepositoryInstance = activeMockInstance;
    }
  }
  return activeRepositoryInstance;
}

/**
 * Atalho para testes unitários acessarem o mock diretamente.
 */
export function getMockMedicationRepository(): MockMedicationRepository {
  const repo = getMedicationRepository();
  if (repo instanceof MockMedicationRepository) {
    return repo;
  }
  if (!activeMockInstance) {
    activeMockInstance = new MockMedicationRepository(
      undefined,
      MEDICATION_REPOSITORY_CONFIG.mockLatencyMs
    );
  }
  return activeMockInstance;
}

/**
 * Altera dinamicamente a fonte de dados (útil para testes de UI ou alternância de flags).
 */
export function setMedicationDataSource(source: RepositoryDataSource): void {
  MEDICATION_REPOSITORY_CONFIG.dataSource = source;
  activeRepositoryInstance = null; // Recria na próxima chamada
}

export { MockMedicationRepository, ApiMedicationRepository };
