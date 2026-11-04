import { useState } from 'react';
import { UserCategoryIcon } from '../../assets/icons';
import type { Profile } from '../../types';

interface UserPhysicalDataCardProps {
  profile: Profile;
  onSave?: (updates: { height: number; weight: number; age: number }) => Promise<void>;
}

export function UserPhysicalDataCard({ profile, onSave }: UserPhysicalDataCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [heightInput, setHeightInput] = useState(String(profile.height));
  const [weightInput, setWeightInput] = useState(String(profile.weight));
  const [ageInput, setAgeInput] = useState(String(profile.age));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formata a altura em metros se estiver em cm (ex.: 165 cm -> "1,65 m")
  const formatHeight = (h: number): string => {
    if (h > 3) {
      return (h / 100).toFixed(2).replace('.', ',') + ' m';
    }
    return h.toFixed(2).replace('.', ',') + ' m';
  };

  const handleStartEdit = () => {
    setHeightInput(String(profile.height));
    setWeightInput(String(profile.weight));
    setAgeInput(String(profile.age));
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setErrorMsg(null);
  };

  const handleSave = async () => {
    const parsedHeight = parseFloat(heightInput.replace(',', '.'));
    const parsedWeight = parseFloat(weightInput.replace(',', '.'));
    const parsedAge = parseInt(ageInput, 10);

    if (isNaN(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300) {
      setErrorMsg('Informe uma altura válida (ex.: 165).');
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500) {
      setErrorMsg('Informe um peso válido em kg.');
      return;
    }
    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 150) {
      setErrorMsg('Informe uma idade válida em anos.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      if (onSave) {
        await onSave({
          height: Math.round(parsedHeight > 3 ? parsedHeight : parsedHeight * 100),
          weight: parsedWeight,
          age: parsedAge,
        });
      }
      setIsEditing(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="user-physical-data-card"
      style={{
        backgroundColor: '#B4ECFB',
        borderRadius: 20,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Cabeçalho da Categoria */}
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
            <UserCategoryIcon size={20} />
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
            Dados físicos
          </h3>
        </div>

        {/* Botão sutil de edição se houver manipulador de salvamento */}
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
            aria-label="Editar dados físicos"
          >
            Editar
          </button>
        )}
      </div>

      {/* Modo de Visualização idêntico ao Figma */}
      {!isEditing ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            width: '100%',
          }}
        >
          {/* Altura */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 16,
                color: '#000000',
                lineHeight: 'normal',
              }}
            >
              Altura
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 20,
                color: '#000000',
                lineHeight: 'normal',
              }}
            >
              {formatHeight(profile.height)}
            </span>
          </div>

          {/* Peso */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 16,
                color: '#000000',
                lineHeight: 'normal',
              }}
            >
              Peso
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 20,
                color: '#000000',
                lineHeight: 'normal',
              }}
            >
              {profile.weight} kg
            </span>
          </div>

          {/* Idade */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 16,
                color: '#000000',
                lineHeight: 'normal',
              }}
            >
              Idade
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 20,
                color: '#000000',
                lineHeight: 'normal',
              }}
            >
              {profile.age}
            </span>
          </div>
        </div>
      ) : (
        /* Formulário de Edição com persistência no IndexedDB */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Altura (cm)
              </label>
              <input
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 10,
                  border: '1px solid #4E6D93',
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Peso (kg)
              </label>
              <input
                type="number"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 10,
                  border: '1px solid #4E6D93',
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Idade
              </label>
              <input
                type="number"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 10,
                  border: '1px solid #4E6D93',
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {errorMsg && (
            <p style={{ color: '#E53935', fontSize: 13, margin: 0, fontFamily: 'var(--font-body)' }}>
              {errorMsg}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              style={{
                background: '#FFFFFF',
                border: '1px solid #4E6D93',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                background: '#000203',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '6px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
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
