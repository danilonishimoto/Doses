import { HeartCategoryIcon } from '../../assets/icons';

interface UserMedicalConditionsCardProps {
  conditionsText?: string;
}

export function UserMedicalConditionsCard({
  conditionsText = 'Menopausa',
}: UserMedicalConditionsCardProps) {
  return (
    <div
      className="user-medical-conditions-card"
      style={{
        backgroundColor: '#BBF9E0',
        borderRadius: 20,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            width: 40,
            height: 40,
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <HeartCategoryIcon size={20} />
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 20,
            lineHeight: '24px',
            color: '#000000',
            margin: 0,
          }}
        >
          Condições médicas
        </h3>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 16,
          color: '#000000',
          lineHeight: 'normal',
          margin: 0,
          whiteSpace: 'pre-line',
        }}
      >
        {conditionsText}
      </p>
    </div>
  );
}
