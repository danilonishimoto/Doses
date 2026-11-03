import { AvatarRenderer } from '../profile/AvatarRenderer';
import { CheckControlIcon } from '../../assets/icons';
import type { DailyMedicationItem } from '../../types';

interface MedicationCardProps {
  item: DailyMedicationItem;
  onToggleStatus?: (id: string) => void;
}

export function MedicationCard({ item, onToggleStatus }: MedicationCardProps) {
  const isCompleted = item.status === 'completed';

  return (
    <article
      className="medication-card"
      style={{
        backgroundColor: item.cardColor,
        borderRadius: 20,
        minHeight: 120,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        position: 'relative',
        boxSizing: 'border-box',
        width: '100%',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div
        className="medication-card-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          className="medication-card-profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.08)',
            }}
          >
            <AvatarRenderer avatar={item.avatar} size={16} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              color: '#000000',
              lineHeight: 1.2,
            }}
          >
            {item.profileName}
          </span>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 18,
            color: '#000203',
            lineHeight: 1.2,
          }}
        >
          {item.time}
        </span>

        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 18,
            color: '#000203',
            lineHeight: 1.2,
          }}
        >
          {item.medicationName}
        </span>

        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 16,
            color: '#000203',
            lineHeight: 1.2,
          }}
        >
          {item.dosage}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onToggleStatus?.(item.id)}
        aria-label={`Marcar ${item.medicationName} das ${item.time} como ${isCompleted ? 'pendente' : 'concluído'}`}
        className="medication-control-btn"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          flexShrink: 0,
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          transition: 'transform 0.1s ease',
        }}
      >
        <CheckControlIcon completed={isCompleted} size={56} />
      </button>
    </article>
  );
}
