import { useState } from 'react';
import { AlertCircleCategoryIcon } from '../../assets/icons';

interface UserAllergiesCardProps {
  allergiesText?: string;
  onSave?: (newText: string) => Promise<void>;
}

export function UserAllergiesCard({
  allergiesText = 'Não informadas.',
  onSave,
}: UserAllergiesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(allergiesText === 'Não informadas.' ? '' : allergiesText);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    setInputValue(allergiesText === 'Não informadas.' ? '' : allergiesText);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    try {
      setIsSaving(true);
      await onSave(inputValue.trim() || 'Não informadas.');
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="user-allergies-card"
      style={{
        backgroundColor: '#FBD4EC',
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
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            <AlertCircleCategoryIcon size={20} />
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
            Alergias
          </h3>
        </div>

        {onSave && !isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: '#000000',
              padding: '4px 8px',
              borderRadius: 8,
              textDecoration: 'underline',
            }}
            aria-label="Editar alergias"
          >
            Editar
          </button>
        )}
      </div>

      {!isEditing ? (
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
          {allergiesText}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ex.: Dipirona, Penicilina, Amendoim..."
            rows={2}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 12,
              border: '1px solid #000000',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              boxSizing: 'border-box',
              resize: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              style={{
                background: 'none',
                border: '1px solid #000000',
                borderRadius: 12,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: '#000000',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                padding: '6px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
