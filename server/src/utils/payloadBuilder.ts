export interface NotificationPayloadInput {
  occurrenceId: string;
  scheduledTime: string;
  profileId: string;
  profileName: string;
  medicationName: string;
  dosage?: string;
  hideMedicationNames?: boolean | number | string | null | undefined;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data: {
    occurrenceId: string;
    profileId: string;
    profileName: string;
    scheduledTime: string;
    medicationName?: string;
    dosage?: string;
    hideMedicationNames: boolean;
  };
}

/**
 * Constrói o payload de notificação Web Push aplicando estritamente a política de privacidade
 * individual de cada subscription / dispositivo.
 * 
 * Regras:
 * 1. Função pura, determinística, sem acesso a I/O, banco de dados ou rede.
 * 2. Se hideMedicationNames for estritamente false ou 0, o nome do medicamento é exibido.
 * 3. Para qualquer outro valor (true, 1, undefined, null, string desconhecida), adota o modo
 *    mais restritivo por padrão: oculta totalmente o nome do medicamento e dosagem.
 * 4. O nome do perfil é SEMPRE mantido, permitindo que a pessoa saiba quem deve tomar o remédio.
 * 5. Quando oculto, o nome do medicamento NÃO pode constar em nenhum campo do JSON (title, body, data).
 */
export function buildNotificationPayload(input: NotificationPayloadInput): NotificationPayload {
  const isExplicitlyFalse = input.hideMedicationNames === false || input.hideMedicationNames === 0;
  const hide = !isExplicitlyFalse;

  const cleanProfileName = (input.profileName || '').trim() || 'Perfil';
  const cleanMedicationName = (input.medicationName || '').trim();
  const cleanDosage = (input.dosage || '').trim();
  const scheduledTime = (input.scheduledTime || '').trim();
  const occurrenceId = (input.occurrenceId || '').trim();
  const profileId = (input.profileId || '').trim();

  if (hide) {
    return {
      title: 'Lembrete de Medicamento',
      body: `Está na hora de um medicamento do ${cleanProfileName}`,
      data: {
        occurrenceId,
        profileId,
        profileName: cleanProfileName,
        scheduledTime,
        hideMedicationNames: true,
      },
    };
  }

  const dosageSuffix = cleanDosage ? ` (${cleanDosage})` : '';
  const bodyText = cleanMedicationName
    ? `Está na hora do medicamento ${cleanMedicationName}${dosageSuffix} do ${cleanProfileName}`
    : `Está na hora de um medicamento do ${cleanProfileName}`;

  const payload: NotificationPayload = {
    title: cleanMedicationName ? `Lembrete: ${cleanMedicationName}` : 'Lembrete de Medicamento',
    body: bodyText,
    data: {
      occurrenceId,
      profileId,
      profileName: cleanProfileName,
      scheduledTime,
      hideMedicationNames: false,
    },
  };

  if (cleanMedicationName) {
    payload.data.medicationName = cleanMedicationName;
  }
  if (cleanDosage) {
    payload.data.dosage = cleanDosage;
  }

  return payload;
}
