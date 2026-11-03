export type ProfileType = 'self' | 'family' | 'care' | 'pet';

export interface Profile {
  id: string;
  name: string;
  type: ProfileType;
  relationship: string;
  birthDate?: string;
  speciesOrNotes?: string;
  avatarColor: string;
  allergiesOrAlerts?: string[];
  activeMedicationsCount?: number;
}

export type MedicationForm =
  | 'Comprimido'
  | 'Cápsula'
  | 'Gotas'
  | 'Xarope'
  | 'Injetável'
  | 'Pomada'
  | 'Spray'
  | 'Outro';

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  instructions: string;
  frequencyLabel: string;
  times: string[]; // formato "HH:mm"
  startDate: string; // formato "YYYY-MM-DD"
  endDate?: string; // formato "YYYY-MM-DD" ou indefinido para uso contínuo
  continuousUse: boolean;
  active: boolean;
  notes?: string;
}

export type DoseStatus = 'pending' | 'administered' | 'skipped' | 'delayed';

export interface DoseLog {
  id: string;
  medicationId: string;
  profileId: string;
  scheduledDate: string; // formato "YYYY-MM-DD"
  scheduledTime: string; // formato "HH:mm"
  status: DoseStatus;
  administeredAt?: string; // ISO string ou "HH:mm"
  administeredBy?: string;
  notes?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  advanceReminderMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  dailySummaryTime: string;
  pushChannelReady: boolean;
}

export interface AppSettings {
  activeProfileFilter: string | 'all';
  highContrastFocus: boolean;
  compactView: boolean;
  notifications: NotificationPreferences;
  lastLocalSyncAt: string;
}

export interface SyncEnvelope<T> {
  version: number;
  updatedAt: string;
  pendingSync: boolean;
  data: T;
}

export interface DosesDatabaseSchema {
  profiles: Profile[];
  medications: Medication[];
  doseLogs: DoseLog[];
  settings: AppSettings;
}
