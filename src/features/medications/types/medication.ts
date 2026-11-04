export type RecurrenceType = 'daily' | 'weekly' | 'custom';

export interface MedicationRecurrence {
  type: RecurrenceType;
  interval?: number; // e.g., every X hours or days
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  schedules: string[]; // ["08:00", "14:00", "20:00"]
  recurrence: MedicationRecurrence;
  instructions?: string;
  cardColor?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type CreateMedicationDTO = Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateMedicationDTO = Partial<Omit<Medication, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>>;
