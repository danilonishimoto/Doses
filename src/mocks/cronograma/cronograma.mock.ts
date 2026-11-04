import type { DailyMedicationItem, Profile, AvatarId } from '../../types';

export interface ScheduledDayMock {
  dateKey: string; // Formato YYYY-MM-DD
  medications: DailyMedicationItem[];
}

export function formatDayDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function formatDateToDateKey(date: Date): string {
  return formatDayDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Retorna os medicamentos programados para uma data específica.
 */
export function getScheduleForDate(
  date: Date,
  profile?: Profile | null
): DailyMedicationItem[] {
  const dateKey = formatDateToDateKey(date);
  const profileName = profile?.name || 'Camilla';
  const avatar: AvatarId = profile?.avatar || 'young-woman';
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed (9 = Outubro)

  // Personalização para Pet Amora
  if (profile?.avatar === 'doguinho-fofo' || profileName.toLowerCase().includes('amora')) {
    if (day % 3 === 0) {
      return [
        {
          id: `${dateKey}-pet-1`,
          profileId: profile?.id,
          profileName,
          avatar,
          time: '09:00',
          medicationName: 'Vermífugo Plus',
          dosage: '1 comprimido mastigável',
          status: 'pending',
          cardColor: '#B4ECFB',
        },
        {
          id: `${dateKey}-pet-2`,
          profileId: profile?.id,
          profileName,
          avatar,
          time: '19:00',
          medicationName: 'Suplemento Articular Ômega',
          dosage: '1 colher de chá na ração',
          status: 'pending',
          cardColor: '#BBF9E0',
        },
      ];
    }
    if (day % 2 === 0) {
      return [
        {
          id: `${dateKey}-pet-1`,
          profileId: profile?.id,
          profileName,
          avatar,
          time: '10:00',
          medicationName: 'Antipulgas NexGard',
          dosage: '1 tablete mastigável',
          status: 'completed',
          cardColor: '#FFF4DA',
        },
      ];
    }
    return [];
  }

  // Personalização para José (Idoso)
  if (profileName.toLowerCase().includes('josé') || profileName.toLowerCase().includes('jose')) {
    if (day % 4 === 0) return []; // Dia sem medicação programada para testar estado vazio
    return [
      {
        id: `${dateKey}-jose-1`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '07:30',
        medicationName: 'Prolopa BD',
        dosage: '1 comprimido · 100/25 mg',
        status: day % 2 === 0 ? 'completed' : 'pending',
        cardColor: '#B4ECFB',
      },
      {
        id: `${dateKey}-jose-2`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '13:00',
        medicationName: 'Levodopa',
        dosage: '1 cápsula · 200 mg',
        status: 'pending',
        cardColor: '#BBF9E0',
      },
      {
        id: `${dateKey}-jose-3`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '19:30',
        medicationName: 'Cálcio + Vitamina D3',
        dosage: '1 comprimido efervescente',
        status: 'pending',
        cardColor: '#FBD4EC',
      },
    ];
  }

  // Padrão (Camilla / Figma 241:7636 e 241:7170)
  // 19 de Outubro (Figma 241:7636) -> 3 medicações
  if (day === 19 && month === 9) {
    return [
      {
        id: `${dateKey}-1`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '08:00',
        medicationName: 'Vitamina D',
        dosage: '1 cápsula · 1.000 UI',
        status: 'completed',
        cardColor: '#B4ECFB',
      },
      {
        id: `${dateKey}-2`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '12:00',
        medicationName: 'Vitamina C',
        dosage: '1 comprimido · 500 mg',
        status: 'completed',
        cardColor: '#BBF9E0',
      },
      {
        id: `${dateKey}-3`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '18:00',
        medicationName: 'Losartana',
        dosage: '1 comprimido · 50 mg',
        status: 'pending',
        cardColor: '#FBD4EC',
      },
    ];
  }

  // 20 de Outubro (Figma 241:7170) -> 4 medicações
  if (day === 20 && month === 9) {
    return [
      {
        id: `${dateKey}-1`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '08:00',
        medicationName: 'Vitamina D',
        dosage: '1 cápsula · 1.000 UI',
        status: 'pending',
        cardColor: '#B4ECFB',
      },
      {
        id: `${dateKey}-2`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '12:00',
        medicationName: 'Vitamina C',
        dosage: '1 comprimido · 500 mg',
        status: 'pending',
        cardColor: '#BBF9E0',
      },
      {
        id: `${dateKey}-3`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '14:00',
        medicationName: 'Paracetamol',
        dosage: '1 comprimido · 750 mg',
        status: 'pending',
        cardColor: '#FBD4EC',
      },
      {
        id: `${dateKey}-4`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '18:00',
        medicationName: 'Losartana',
        dosage: '1 comprimido · 50 mg',
        status: 'pending',
        cardColor: '#FFF4DA',
      },
    ];
  }

  // Dias com 0 medicações (ex: dia 5 ou dias múltiplos de 7) para estado vazio
  if (day === 5 || day === 21 || day === 31) {
    return [];
  }

  // 1 medicação nos dias pares
  if (day % 2 === 0) {
    return [
      {
        id: `${dateKey}-1`,
        profileId: profile?.id,
        profileName,
        avatar,
        time: '08:00',
        medicationName: 'Vitamina D',
        dosage: '1 cápsula · 1.000 UI',
        status: 'completed',
        cardColor: '#B4ECFB',
      },
    ];
  }

  // 2 medicações nos dias ímpares
  return [
    {
      id: `${dateKey}-1`,
      profileId: profile?.id,
      profileName,
      avatar,
      time: '08:00',
      medicationName: 'Vitamina D',
      dosage: '1 cápsula · 1.000 UI',
      status: 'completed',
      cardColor: '#B4ECFB',
    },
    {
      id: `${dateKey}-2`,
      profileId: profile?.id,
      profileName,
      avatar,
      time: '12:00',
      medicationName: 'Vitamina C',
      dosage: '1 comprimido · 500 mg',
      status: 'pending',
      cardColor: '#BBF9E0',
    },
  ];
}

/**
 * Retorna a quantidade de medicações programadas para a data (número de bolinhas no calendário).
 */
export function getMedicationCountForDate(date: Date, profile?: Profile | null): number {
  return getScheduleForDate(date, profile).length;
}
