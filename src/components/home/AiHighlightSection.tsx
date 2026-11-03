import { useState } from 'react';
import { DosesAiSphere, TapMeArrow } from '../../assets/icons';

interface AiHighlightSectionProps {
  onTap?: () => void;
}

export function AiHighlightSection({ onTap }: AiHighlightSectionProps) {
  const [isTapped, setIsTapped] = useState(false);

  const handleClick = () => {
    setIsTapped(true);
    setTimeout(() => setIsTapped(false), 300);
    onTap?.();
  };

  return (
    <section
      aria-label="Assistente Doses"
      className="ai-highlight-section"
      style={{
        width: '100%',
        height: 150,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '8px 0',
      }}
    >
      {/* Indicador "Tap me" com seta apontando para a esfera */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
            fontSize: 20,
            color: '#000000',
            lineHeight: 1.2,
          }}
        >
          Tap me
        </span>
        <div style={{ marginLeft: 24, marginTop: -4 }}>
          <TapMeArrow width={32} height={20} />
        </div>
      </div>

      {/* Esfera central da IA clicável */}
      <button
        type="button"
        onClick={handleClick}
        aria-label="Acessar assistente inteligente Doses"
        className="ai-sphere-button"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          borderRadius: 75,
          outline: 'none',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: isTapped ? 'scale(0.94)' : 'scale(1)',
          display: 'block',
        }}
      >
        <DosesAiSphere size={150} />
      </button>
    </section>
  );
}
