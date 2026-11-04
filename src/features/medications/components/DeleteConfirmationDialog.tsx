import React, { useEffect } from 'react';
import type { Medication } from '../types/medication';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  medication: Medication | null;
  profileName?: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  medication,
  profileName = 'Camilla',
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen || !medication) return null;

  const schedulesText = medication.schedules.length > 0
    ? medication.schedules.join(' e ')
    : 'horários programados';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 37, 78, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '24px',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          maxWidth: 354,
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <h2
          id="delete-dialog-title"
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 600,
            color: '#000000',
            fontFamily: 'Urbanist, sans-serif',
            lineHeight: 1.2,
          }}
        >
          Remover {medication.name}?
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: '16px',
            color: '#000203',
            lineHeight: 'normal',
            fontFamily: 'Open Sans, sans-serif',
          }}
        >
          {medication.name} deixará de aparecer nos medicamentos ativos de {profileName} e nos horários programados de {schedulesText}.
        </p>

        {/* Secondary Action: Cancelar (Figma node 301:7249) */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          style={{
            height: '56px',
            width: '100%',
            borderRadius: '20px',
            border: '1px solid #000203',
            backgroundColor: '#FFFFFF',
            color: '#000203',
            fontFamily: 'Urbanist, sans-serif',
            fontSize: '20px',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Cancelar
        </button>

        {/* Primary Action: Remover medicamento (Figma node 301:7246 DosesBotaoPrincipal) */}
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          style={{
            minHeight: '96px',
            width: '100%',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: '#000203',
            color: '#FFFFFF',
            fontFamily: 'Urbanist, sans-serif',
            fontSize: '20px',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          {isSubmitting ? 'Removendo...' : 'Remover medicamento'}
        </button>
      </div>
    </div>
  );
};
