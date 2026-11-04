import { useState } from 'react';
import { CloseIcon, TrashIcon, EditIcon, FileTextIcon } from '../../assets/icons';
import { AvatarRenderer } from '../profile/AvatarRenderer';
import type { ReceitaMedicaItem } from '../../types';

interface ReceitaDetailModalProps {
  receita: ReceitaMedicaItem | null;
  onClose: () => void;
  onEdit: (receita: ReceitaMedicaItem) => void;
  onDelete: (receitaId: string) => void;
}

export function ReceitaDetailModal({
  receita,
  onClose,
  onEdit,
  onDelete,
}: ReceitaDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!receita) return null;

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(receita.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-receita-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 2, 3, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        className="receita-detail-sheet"
        style={{
          width: '100%',
          maxWidth: 402,
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de controle */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: receita.cardColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00254E',
              }}
            >
              <FileTextIcon size={20} />
            </div>
            <div>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-body)',
                  color: '#4E6D93',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Receita Médica
              </span>
              <h2
                id="modal-receita-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  color: '#000000',
                  lineHeight: 1.2,
                }}
              >
                {receita.specialty}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => onEdit(receita)}
              aria-label="Editar esta receita"
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
                borderRadius: 12,
                color: '#4E6D93',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <EditIcon size={20} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Excluir receita"
              style={{
                background: confirmDelete ? 'var(--color-bg-error)' : 'none',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
                borderRadius: 12,
                color: confirmDelete ? 'var(--color-border-error)' : '#4E6D93',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrashIcon size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes"
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
                borderRadius: 12,
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CloseIcon size={22} />
            </button>
          </div>
        </div>

        {/* Alerta de confirmação de exclusão */}
        {confirmDelete && (
          <div
            style={{
              backgroundColor: 'var(--color-bg-error)',
              borderBottom: '1px solid var(--color-border-error)',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontFamily: 'var(--font-body)',
                color: 'var(--color-border-error)',
                fontWeight: 600,
              }}
            >
              Confirmar exclusão desta receita?
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #D0D5DD',
                  borderRadius: 12,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  backgroundColor: 'var(--color-border-error)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                Sim, excluir
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo rolável */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxSizing: 'border-box',
          }}
        >
          {/* Card de Informações Principais */}
          <div
            style={{
              backgroundColor: receita.cardColor,
              borderRadius: 20,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AvatarRenderer avatar={receita.avatar} size={22} />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 15,
                  color: '#000000',
                }}
              >
                Paciente: {receita.profileName}
              </span>
            </div>

            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: '#000000',
                }}
              >
                {receita.doctorName}
              </p>
              {receita.crm && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    color: '#4E6D93',
                  }}
                >
                  {receita.crm}
                </p>
              )}
              {receita.clinicOrHospital && (
                <p
                  style={{
                    margin: '2px 0 0 0',
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    color: '#1E1E1E',
                  }}
                >
                  {receita.clinicOrHospital}
                </p>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 16,
                paddingTop: 8,
                borderTop: '1px solid rgba(0,0,0,0.08)',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                color: '#1E1E1E',
              }}
            >
              <span>
                <strong>Emissão:</strong> {receita.emissionDate}
              </span>
              {receita.expirationDate && (
                <span>
                  <strong>Validade:</strong> {receita.expirationDate}
                </span>
              )}
            </div>
          </div>

          {/* Medicamentos Prescritos */}
          <div>
            <h3
              style={{
                margin: '0 0 10px 0',
                fontSize: 16,
                fontFamily: 'var(--font-heading)',
                fontWeight: 700,
                color: '#000000',
              }}
            >
              Medicamentos Prescritos
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {receita.medications.map((med, idx) => (
                <div
                  key={`${med}-${idx}`}
                  style={{
                    backgroundColor: '#F7FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 14,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: 15,
                      color: '#000000',
                    }}
                  >
                    {med}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'var(--font-body)',
                      color: '#4E6D93',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: 999,
                      padding: '2px 8px',
                    }}
                  >
                    Prescrito
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Instruções e Orientações */}
          {receita.instructions && (
            <div>
              <h3
                style={{
                  margin: '0 0 10px 0',
                  fontSize: 16,
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  color: '#000000',
                }}
              >
                Instruções de Uso & Posologia
              </h3>
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#1E1E1E',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                }}
              >
                {receita.instructions}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com botão Fechar */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="primary-action-button"
            style={{
              width: '100%',
              height: 48,
              borderRadius: 20,
              backgroundColor: '#000203',
              color: '#FFFFFF',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 18,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Fechar detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
