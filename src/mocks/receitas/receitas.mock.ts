import type { ReceitaMedicaItem, Profile } from '../../types';

export const FIGMA_RECEITAS_MOCK: ReceitaMedicaItem[] = [
  {
    id: 'rec-1',
    profileName: 'Camilla',
    avatar: 'young-woman',
    specialty: 'Nutricionista',
    doctorName: 'Dra. Ana Martins',
    crm: 'CRM/SP 182.492',
    clinicOrHospital: 'Consultório Nutrição Integrada',
    emissionDate: '15/10/2026',
    expirationDate: '15/04/2027',
    medications: ['Vitamina C', 'Vitamina D'],
    instructions:
      'Vitamina C 500 mg: 1 comprimido ao dia após o café da manhã.\nVitamina D 2.000 UI: 2 gotas pela manhã junto à refeição.',
    cardColor: '#B4ECFB',
  },
  {
    id: 'rec-2',
    profileName: 'Camilla',
    avatar: 'young-woman',
    specialty: 'Cardiologista',
    doctorName: 'Dr. Pedro Almeida',
    crm: 'CRM/SP 149.803',
    clinicOrHospital: 'Instituto do Coração & Saúde',
    emissionDate: '08/10/2026',
    expirationDate: '08/04/2027',
    medications: ['Losartana 50 mg'],
    instructions:
      'Losartana 50 mg: 1 comprimido pela manhã em jejum. Aferir a pressão arterial semanalmente e registrar os valores.',
    cardColor: '#BBF9E0',
  },
  {
    id: 'rec-3',
    profileName: 'Camilla',
    avatar: 'young-woman',
    specialty: 'Endocrinologista',
    doctorName: 'Dra. Júlia Costa',
    crm: 'CRM/SP 205.114',
    clinicOrHospital: 'Centro Médico Especializado',
    emissionDate: '02/10/2026',
    expirationDate: '02/11/2026',
    medications: ['Amoxicilina 500 mg'],
    instructions:
      'Amoxicilina 500 mg: Tomar 1 cápsula de 8 em 8 horas por 7 dias seguidos. Não interromper antes do prazo.',
    cardColor: '#FBD4EC',
  },
  {
    id: 'rec-4',
    profileName: 'Camilla',
    avatar: 'young-woman',
    specialty: 'Ginecologista',
    doctorName: 'Dra. Ana Martins',
    crm: 'CRM/SP 182.492',
    clinicOrHospital: 'Clínica da Mulher & Bem-Estar',
    emissionDate: '25/09/2026',
    expirationDate: '25/03/2027',
    medications: ['Loratadina 10 mg'],
    instructions:
      'Loratadina 10 mg: Tomar 1 comprimido à noite ao deitar em caso de sintomas alérgicos sazonais ou rinite.',
    cardColor: '#FFF4DA',
  },
];

export function getReceitasMock(profile?: Profile | null): ReceitaMedicaItem[] {
  if (!profile) {
    return [...FIGMA_RECEITAS_MOCK];
  }

  const lowerName = profile.name.toLowerCase();

  // Se for José (idoso)
  if (lowerName.includes('josé') || lowerName.includes('jose')) {
    return [
      {
        id: `rec-jose-1`,
        profileId: profile.id,
        profileName: profile.name,
        avatar: profile.avatar,
        specialty: 'Neurologista',
        doctorName: 'Dr. Roberto Santos',
        crm: 'CRM/SP 112.304',
        clinicOrHospital: 'Clínica de Neurologia Avançada',
        emissionDate: '10/10/2026',
        expirationDate: '10/04/2027',
        medications: ['Prolopa 200 mg', 'Levodopa 100 mg'],
        instructions:
          'Prolopa 200 mg: 1 comprimido 30 minutos antes do almoço e do jantar.\nManter hidratação regular.',
        cardColor: '#B4ECFB',
      },
      {
        id: `rec-jose-2`,
        profileId: profile.id,
        profileName: profile.name,
        avatar: profile.avatar,
        specialty: 'Geriatra',
        doctorName: 'Dra. Silvia Guimarães',
        crm: 'CRM/SP 98.712',
        clinicOrHospital: 'Hospital da Longevidade',
        emissionDate: '01/10/2026',
        expirationDate: '01/04/2027',
        medications: ['Cálcio + D3', 'Ômega 3'],
        instructions: 'Cálcio com Vitamina D: 1 comprimido após o almoço diariamente.',
        cardColor: '#BBF9E0',
      },
    ];
  }

  // Se for Amora (Pet)
  if (lowerName.includes('amora') || profile.avatar === 'doguinho-fofo') {
    return [
      {
        id: `rec-pet-1`,
        profileId: profile.id,
        profileName: profile.name,
        avatar: profile.avatar,
        specialty: 'Veterinário',
        doctorName: 'Dra. Marina Vet',
        crm: 'CRMV/SP 45.120',
        clinicOrHospital: 'Hospital Veterinário PetCare',
        emissionDate: '12/10/2026',
        expirationDate: '12/12/2026',
        medications: ['Vermífugo Plus', 'Antipulgas NexGard'],
        instructions: 'Administrar junto ao sachê ou ração úmida conforme o peso.',
        cardColor: '#FFF4DA',
      },
    ];
  }

  // Padrão: perfil atual (ex: Camilla ou outro usuário cadastrado)
  return FIGMA_RECEITAS_MOCK.map((item) => ({
    ...item,
    profileId: profile.id,
    profileName: profile.name,
    avatar: profile.avatar,
  }));
}
