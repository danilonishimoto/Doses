import React from 'react';
import type { Medication } from '../types/medication';
import { EditIcon, TrashIcon } from '../../../assets/icons';

interface MedicationManagementCardProps {
  medication: Medication;
  onEdit: (medication: Medication) => void;
  onDelete: (medication: Medication) => void;
}

const DAYS_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatRecurrence(medication: Medication): string {
  const { recurrence } = medication;
  if (!recurrence || recurrence.type === 'daily') {
    return 'Todos os dias';
  }
  if (recurrence.type === 'weekly') {
    if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
      return recurrence.daysOfWeek.map((d) => DAYS_NAMES[d] || d).join(', ');
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
  return 'Diário';
}

export const MedicationManagementCard: React.FC<MedicationManagementCardProps> = ({
  medication,
  onEdit,
  onDelete,
}) => {
  const cardColor = medication.cardColor || '#B4ECFB';
  const recurrenceLabel = formatRecurrence(medication);

  return (
    <article
      data-testid={`medication-card-${medication.id}`}
      style={{
        backgroundColor: cardColor,
        borderRadius: 20,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0, 37, 78, 0.08)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Top Header: Title & Recurrence badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: '#00254E',
              fontFamily: 'Open Sans, sans-serif',
              lineHeight: '1.25',
              wordBreak: 'break-word',
            }}
          >
            {medication.name}
          </h3>
          <span
            style={{
              display: 'inline-block',
              marginTop: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#004080',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              padding: '2px 8px',
              borderRadius: '12px',
            }}
          >
            {recurrenceLabel}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => onEdit(medication)}
            aria-label={`Editar ${medication.name}`}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0, 37, 78, 0.15)',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#00254E',
              transition: 'background-color 0.15s ease',
            }}
          >
            <EditIcon size={18} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(medication)}
            aria-label={`Excluir ${medication.name}`}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#DC2626',
              transition: 'background-color 0.15s ease',
            }}
          >
            <TrashIcon size={18} />
          </button>
        </div>
      </div>

      {/* Schedules row */}
      <div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#4B5563',
            marginBottom: '4px',
          }}
        >
          Horários previstos:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {medication.schedules.map((time, idx) => (
            <span
              key={`${time}-${idx}`}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#00254E',
                fontSize: '13px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 37, 78, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ⏰ {time}
            </span>
          ))}
        </div>
      </div>

      {/* Instructions / Dosage */}
      {medication.instructions && (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#1F2937',
            lineHeight: '1.4',
            fontFamily: 'Open Sans, sans-serif',
          }}
        >
          <strong style={{ color: '#00254E' }}>Instruções:</strong> {medication.instructions}
        </div>
      )}
    </article>
  );
};
