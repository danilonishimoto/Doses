import type { DailyMedicationItem, Profile } from '../../types';

export const INITIAL_DAILY_MEDICATIONS: DailyMedicationItem[] = [
  {
    id: 'med-1',
    profileName: 'Camilla',
    avatar: 'young-woman',
    time: '08:00',
    medicationName: 'Vitamina D',
    dosage: '1 cápsula',
    status: 'completed',
    cardColor: '#B4ECFB',
  },
  {
    id: 'med-2',
    profileName: 'Camilla',
    avatar: 'young-woman',
    time: '14:00',
    medicationName: 'Vitamina D',
    dosage: '1 cápsula',
    status: 'completed',
    cardColor: '#FFF6E1',
  },
  {
    id: 'med-3',
    profileName: 'José',
    avatar: 'senior-person',
    time: '09:00',
    medicationName: 'Novalgina',
    dosage: '1 cápsula',
    status: 'pending',
    cardColor: '#BBF9E0',
  },
  {
    id: 'med-4',
    profileName: 'Camilla',
    avatar: 'young-woman',
    time: '20:00',
    medicationName: 'Vitamina D',
    dosage: '1 cápsula',
    status: 'pending',
    cardColor: '#E8F4F1',
  },
];

export function getDailyMedicationsMock(activeProfile?: Profile | null): DailyMedicationItem[] {
  if (!activeProfile) {
    return INITIAL_DAILY_MEDICATIONS;
  }

  // Se houver perfil ativo, adapta os itens principais do mock para o perfil selecionado
  return INITIAL_DAILY_MEDICATIONS.map((item, index) => {
    // Mantém o item do 'José' como dependente se o perfil ativo for diferente,
    // ou se o perfil ativo for o próprio José, usa o nome do perfil ativo em todos
    if (index === 2 && activeProfile.name.toLowerCase() !== 'josé') {
      return item;
    }

    return {
      ...item,
      profileName: activeProfile.name,
      avatar: activeProfile.avatar,
      profileId: activeProfile.id,
    };
  });
}
