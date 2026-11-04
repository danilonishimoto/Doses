import React from 'react';
import type { Medication } from '../types/medication';
import { AvatarRenderer } from '../../../components/profile/AvatarRenderer';
import { EditIcon, TrashIcon } from '../../../assets/icons';
import type { AvatarId } from '../../../types';

interface MedicationManagementCardProps {
  medication: Medication;
  profileName?: string;
  profileAvatar?: AvatarId;
  onEdit: (medication: Medication) => void;
  onDelete: (medication: Medication) => void;
}

const WEEK_DAY_NAMES: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
  0: 'Dom',
};

function formatRecurrence(medication: Medication): string {
  const { recurrence } = medication;
  if (!recurrence || recurrence.type === 'daily') {
    return 'Todos os dias';
  }
  if (recurrence.type === 'weekly') {
    if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
      if (recurrence.daysOfWeek.length === 7) return 'Todos os dias';
      return recurrence.daysOfWeek
        .map((d) => WEEK_DAY_NAMES[d] || String(d))
        .join(', ');
    }
    if (recurrence.interval && recurrence.interval > 1) {
      return `A cada ${recurrence.interval} semanas`;
    }
    return 'Semanalmente';
  }
  if (recurrence.type === 'custom') {
    if (recurrence.interval) {
      return `A cada ${recurrence.interval} horas`;
    }
    return 'Personalizado';
  }
  return 'Todos os dias';
}

export const MedicationManagementCard: React.FC<MedicationManagementCardProps> = ({
  medication,
  profileName = 'Camilla',
  profileAvatar = 'young-woman',
  onEdit,
  onDelete,
}) => {
  const cardColor = medication.cardColor || '#E6F4FF';
  const recurrenceLabel = formatRecurrence(medication);
  const formattedSchedules = medication.schedules.length > 0
    ? medication.schedules.join(' · ')
    : '--:--';

  return (
    <article
      data-testid={`medication-card-${medication.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {/* Card Content (Figma node 301:6722) */}
      <div
        style={{
          backgroundColor: cardColor,
          borderRadius: '20px',
          minHeight: '120px',
          padding: '16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          width: '100%',
        }}
      >
        {/* Profile Info Row (Figma node I301:6722;219:43) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', overflow: 'hidden' }}>
            <AvatarRenderer avatar={profileAvatar} size={16} />
          </div>
          <span
            style={{
              fontFamily: 'Open Sans, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              color: '#000000',
              lineHeight: 'normal',
            }}
          >
            {profileName}
          </span>
        </div>

        {/* Medication Name (Figma node I301:6722;214:108) */}
        <h3
          style={{
            margin: 0,
            fontFamily: 'Open Sans, sans-serif',
            fontWeight: 600,
            fontSize: '18px',
            color: '#000000',
            lineHeight: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {medication.name}
        </h3>

        {/* Schedules (Figma node I301:6722;214:109) */}
        <p
          style={{
            margin: 0,
            fontFamily: 'Open Sans, sans-serif',
            fontWeight: 600,
            fontSize: '24px',
            color: '#000000',
            lineHeight: 'normal',
          }}
        >
          {formattedSchedules}
        </p>

        {/* Recurrence (Figma node I301:6722;214:110) */}
        <p
          style={{
            margin: 0,
            fontFamily: 'Open Sans, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            color: '#000000',
            lineHeight: 'normal',
          }}
        >
          {recurrenceLabel}
        </p>

        {/* Instructions / Dosage (if present) */}
        {medication.instructions && (
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: 'Open Sans, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: '#4E6D93',
              lineHeight: 'normal',
            }}
          >
            {medication.instructions}
          </p>
        )}
      </div>

      {/* Management Actions (Figma node 301:6756) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          width: '100%',
        }}
      >
        {/* Editar medicamento */}
        <button
          type="button"
          onClick={() => onEdit(medication)}
          aria-label={`Editar ${medication.name}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '48px',
            padding: '0 12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#000000',
            fontFamily: 'Open Sans, sans-serif',
            fontSize: '16px',
            fontWeight: 400,
          }}
        >
          <EditIcon size={18} />
          <span>Editar</span>
        </button>

        {/* Remover medicamento */}
        <button
          type="button"
          onClick={() => onDelete(medication)}
          aria-label={`Remover ${medication.name}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '48px',
            padding: '0 12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#000000',
            fontFamily: 'Open Sans, sans-serif',
            fontSize: '16px',
            fontWeight: 400,
          }}
        >
          <TrashIcon size={18} />
          <span>Remover</span>
        </button>
      </div>
    </article>
  );
};
