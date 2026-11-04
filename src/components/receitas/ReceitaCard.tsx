import { AvatarRenderer } from '../profile/AvatarRenderer';
import type { ReceitaMedicaItem } from '../../types';

interface ReceitaCardProps {
  receita: ReceitaMedicaItem;
  onAccess: (receita: ReceitaMedicaItem) => void;
}

export function ReceitaCard({ receita, onAccess }: ReceitaCardProps) {
  return (
    <article
      className="receita-card"
      style={{
        backgroundColor: receita.cardColor,
        borderRadius: 20,
        minHeight: 120,
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxSizing: 'border-box',
        width: '100%',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      aria-label={`Receita de ${receita.specialty} emitida por ${receita.doctorName}`}
    >
      {/* Conteúdo textual da receita */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Identificação do perfil associado */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <AvatarRenderer avatar={receita.avatar} size={18} />
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
            {receita.profileName}
          </span>
        </div>

        {/* Especialidade médica */}
        <h2
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 18,
            color: '#000000',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {receita.specialty}
        </h2>

        {/* Profissional e data de emissão */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 15,
              color: '#000000',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {receita.doctorName}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 14,
              color: '#1E1E1E',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Emitida em {receita.emissionDate}
          </p>
        </div>

        {/* Tags de medicamentos receitados */}
        {receita.medications.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 4,
            }}
            aria-label="Medicamentos receitados"
          >
            {receita.medications.map((med, idx) => (
              <span
                key={`${med}-${idx}`}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #00254E',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: '#000000',
                  whiteSpace: 'nowrap',
                }}
              >
                {med}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Botão Acessar (Conforme Figma 225:320) */}
      <button
        type="button"
        onClick={() => onAccess(receita)}
        aria-label={`Acessar receita de ${receita.specialty}`}
        className="receita-access-button"
        style={{
          backgroundColor: '#000203',
          color: '#FFFFFF',
          borderRadius: 20,
          height: 44,
          minWidth: 98,
          padding: '0 16px',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          transition: 'transform 0.1s ease, opacity 0.1s ease',
        }}
      >
        Acessar
      </button>
    </article>
  );
}
