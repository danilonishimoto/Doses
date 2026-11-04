import type { CreateMedicationDTO, Medication, UpdateMedicationDTO } from '../types/medication';

export interface MedicationRepository {
  /**
   * List all medications belonging to a specific profile.
   */
  list(profileId: string): Promise<Medication[]>;

  /**
   * Retrieve a single medication by ID.
   */
  getById(id: string): Promise<Medication | null>;

  /**
   * Create a new medication associated with the given profile.
   */
  create(data: CreateMedicationDTO): Promise<Medication>;

  /**
   * Update an existing medication by ID.
   */
  update(id: string, data: UpdateMedicationDTO): Promise<Medication>;

  /**
   * Delete an existing medication by ID.
   */
  delete(id: string): Promise<void>;
}
