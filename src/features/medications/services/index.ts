import type { MedicationRepository } from './medicationRepository';
import { MockMedicationRepository } from './mockMedicationRepository';
import { ApiMedicationRepository } from './apiMedicationRepository';

export type RepositoryDataSource = 'mock' | 'api';

// Configuration point: toggle here or via environment variables
export const MEDICATION_REPOSITORY_CONFIG = {
  dataSource: 'mock' as RepositoryDataSource,
  apiUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1',
  mockLatencyMs: 200,
};

let activeRepositoryInstance: MedicationRepository | null = null;
let activeMockInstance: MockMedicationRepository | null = null;

/**
 * Returns the singleton MedicationRepository according to the current configuration.
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
 * Convenience helper to access the mock repository directly for testing and error simulation.
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
 * Dynamically switch the data source at runtime (e.g. for testing or feature flags).
 */
export function setMedicationDataSource(source: RepositoryDataSource): void {
  MEDICATION_REPOSITORY_CONFIG.dataSource = source;
  activeRepositoryInstance = null; // Re-create on next getMedicationRepository call
}

export * from './medicationRepository';
export * from './mockMedicationRepository';
export * from './apiMedicationRepository';
