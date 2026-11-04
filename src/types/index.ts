export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type AvatarId = 'young-woman' | 'senior-person' | 'doguinho-fofo';

export interface Profile {
  id: string;
  accountId: string;
  name: string;
  surname: string;
  age: number;
  weight: number;
  height: number;
  avatar: AvatarId;
  isMainProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingDraft {
  username?: string;
  password?: string;
  mainProfile?: {
    avatar: AvatarId;
    name: string;
    surname: string;
    age: string;
    weight: string;
    height: string;
  };
}

export type NavigationTab = 'home' | 'cronograma' | 'receitas' | 'usuarios';

export type MedicationStatus = 'completed' | 'pending';

export interface DailyMedicationItem {
  id: string;
  profileId?: string;
  profileName: string;
  avatar: AvatarId;
  time: string;
  medicationName: string;
  dosage: string;
  status: MedicationStatus;
  cardColor: string;
}

export interface ReceitaMedicaItem {
  id: string;
  profileId?: string;
  profileName: string;
  avatar: AvatarId;
  specialty: string;
  doctorName: string;
  crm?: string;
  clinicOrHospital?: string;
  emissionDate: string;
  expirationDate?: string;
  medications: string[];
  instructions?: string;
  cardColor: string;
}
