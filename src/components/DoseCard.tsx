import { AlertIcon, CheckCircleIcon, ClockIcon, PetPawIcon } from '../assets/icons';
import { DoseLog, Medication, Profile } from '../types';
import { getPeriodOfDay } from '../utils/dateUtils';

interface DoseCardProps {
  dose: DoseLog;
  medication: Medication;
  profile: Profile;
  onToggleStatus: (doseId: string, nextStatus: 'administered' | 'pending') => void;
}

export function DoseCard({ dose, medication, profile, onToggleStatus }: DoseCardProps) {
  const isAdministered = dose.status === 'administered';
  const period = getPeriodOfDay(dose.scheduledTime);

  return (
    <article
      className="dose-item"
      data-status={dose.status}
      aria-labelledby={`dose-title-${dose.id}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <div className="flex-row-gap">
          <span
            className="badge badge-neutral"
            style={{ fontFamily: 'var(--font-heading)', fontSize: '0.88rem' }}
          >
            <ClockIcon size={15} />
            <span>
              {dose.scheduledTime} • {period}
            </span>
          </span>

          <span className="badge badge-neutral">
            <span
              className="avatar-dot"
              style={{ backgroundColor: profile.avatarColor }}
              aria-hidden="true"
            />
            {profile.type === 'pet' && <PetPawIcon size={14} />}
            <span>{profile.name}</span>
          </span>

          {isAdministered ? (
            <span className="badge badge-administered">
              <CheckCircleIcon size={15} />
              <span>Administrado às {dose.administeredAt}</span>
            </span>
          ) : (
            <span className="badge badge-pending">
              <AlertIcon size={15} />
              <span>Dose pendente</span>
            </span>
          )}
        </div>

        <h3 id={`dose-title-${dose.id}`}>
          {medication.name} — {medication.dosage} ({medication.form})
        </h3>

        <p style={{ fontSize: '0.88rem' }}>{medication.instructions}</p>

        {dose.notes && (
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-blue-mid)',
              fontWeight: 600,
            }}
          >
            Observação: {dose.notes}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {isAdministered ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onToggleStatus(dose.id, 'pending')}
            aria-label={`Desfazer registro de ${medication.name} das ${dose.scheduledTime} para ${profile.name}`}
          >
            Desfazer registro
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-success"
            onClick={() => onToggleStatus(dose.id, 'administered')}
            aria-label={`Registrar dose de ${medication.name} (${medication.dosage}) das ${dose.scheduledTime} para ${profile.name}`}
          >
            <CheckCircleIcon size={18} />
            <span>Confirmar dose</span>
          </button>
        )}
      </div>
    </article>
  );
}
