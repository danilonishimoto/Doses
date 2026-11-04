export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type AvatarId =
  | 'young-woman'
  | 'senior-person'
  | 'doguinho-fofo'
  | 'profile-01'
  | 'profile-02'
  | 'profile-03'
  | 'profile-04'
  | 'profile-05'
  | 'profile-06'
  | 'profile-07'
  | 'profile-08'
  | 'profile-09'
  | 'profile-10'
  | 'profile-11'
  | 'profile-12'
  | 'profile-13'
  | 'profile-14';

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

export type NavigationTab = 'home' | 'cronograma' | 'receitas' | 'medicamentos' | 'usuarios';

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
