import React, { useState, useEffect, useCallback } from 'react';
import { CloseIcon, DosesLogo } from '../../assets/icons';
import {
  shouldShowSafariPwaPrompt,
  dismissSafariPwaPrompt,
  DeviceEnvironment,
} from '../../utils/safariPwaPrompt';

export interface SafariInstallPwaModalProps {
  /**
   * Força a abertura para testes ou previews visuais.
   */
  forceOpen?: boolean;
  /**
   * Callback opcional disparado quando o modal é fechado ou dispensado.
   */
  onDismiss?: () => void;
  /**
   * Sobrescreve o ambiente do dispositivo para testes.
   */
  environmentOverride?: DeviceEnvironment;
}

export const SafariInstallPwaModal: React.FC<SafariInstallPwaModalProps> = ({
  forceOpen,
  onDismiss,
  environmentOverride,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (forceOpen) return true;
    return shouldShowSafariPwaPrompt(environmentOverride);
  });

  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }
    setIsOpen(shouldShowSafariPwaPrompt(environmentOverride));
  }, [forceOpen, environmentOverride]);

  const handleClose = useCallback(() => {
    dismissSafariPwaPrompt();
    setIsOpen(false);
    onDismiss?.();
  }, [onDismiss]);

  // Acessibilidade: fechar ao pressionar a tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="safari-pwa-title"
      aria-describedby="safari-pwa-desc"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 2, 3, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="safari-pwa-modal-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          maxWidth: 400,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho do Card com Logo, Título e Botão Fechar */}
        <div
          style={{
            padding: '24px 20px 16px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#F4F7FB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DosesLogo width={36} height={36} />
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#4E6D93',
                  marginBottom: 2,
                  fontFamily: 'Urbanist, sans-serif',
                }}
              >
                Instalação no iPhone
              </span>
              <h2
                id="safari-pwa-title"
                style={{
                  margin: 0,
                  fontSize: 19,
                  fontWeight: 700,
                  color: '#000203',
                  fontFamily: 'Urbanist, sans-serif',
                  lineHeight: 1.25,
                }}
              >
                Tenha o Doses sempre com você!
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar modal"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 8,
              margin: '-8px -4px 0 0',
              cursor: 'pointer',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll Interno se Necessário */}
        <div
          style={{
            padding: '16px 24px 20px 24px',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <p
            id="safari-pwa-desc"
            style={{
              margin: 0,
              fontSize: 14,
              color: '#334155',
              lineHeight: 1.5,
              fontFamily: 'Open Sans, sans-serif',
            }}
          >
            Adicione o Doses à tela inicial do seu iPhone para acessar seus medicamentos e acompanhar seus horários com mais praticidade.
          </p>

          {/* Etapas Ilustradas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Etapa 1 */}
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#4E6D93',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'Urbanist, sans-serif',
                }}
              >
                1
              </div>

              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 14,
                    color: '#000203',
                    fontFamily: 'Urbanist, sans-serif',
                    marginBottom: 2,
                  }}
                >
                  Toque em Compartilhar
                </strong>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: '#475569',
                    lineHeight: 1.4,
                    fontFamily: 'Open Sans, sans-serif',
                  }}
                >
                  No Safari, toque no ícone de compartilhamento (quadrado com seta para cima), na barra inferior ou superior.
                </span>
              </div>

              {/* Ícone Safari Share */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
            </div>

            {/* Etapa 2 */}
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#4E6D93',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'Urbanist, sans-serif',
                }}
              >
                2
              </div>

              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 14,
                    color: '#000203',
                    fontFamily: 'Urbanist, sans-serif',
                    marginBottom: 2,
                  }}
                >
                  Selecione "Adicionar à Tela de Início"
                </strong>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: '#475569',
                    lineHeight: 1.4,
                    fontFamily: 'Open Sans, sans-serif',
                  }}
                >
                  Na lista de opções, procure e selecione "Adicionar à Tela de Início".
                </span>
              </div>

              {/* Ícone Add to Home Screen */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  border: '1px solid #CBD5E1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
            </div>

            {/* Etapa 3 */}
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: '#4E6D93',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'Urbanist, sans-serif',
                }}
              >
                3
              </div>

              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: 14,
                    color: '#000203',
                    fontFamily: 'Urbanist, sans-serif',
                    marginBottom: 2,
                  }}
                >
                  Confirme a instalação
                </strong>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: '#475569',
                    lineHeight: 1.4,
                    fontFamily: 'Open Sans, sans-serif',
                  }}
                >
                  Toque em "Adicionar", no canto superior direito. Pronto! O ícone do Doses estará disponível na sua tela de início.
                </span>
              </div>

              {/* Botão de confirmação estilo iOS */}
              <div
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#EBF5FF',
                  borderRadius: 8,
                  border: '1px solid #B9E1FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#007AFF',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                >
                  Adicionar
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé com Botão Principal para dispensar */}
        <div
          style={{
            padding: '16px 24px 24px 24px',
            borderTop: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              width: '100%',
              height: 52,
              backgroundColor: '#000203',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 20,
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'Urbanist, sans-serif',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease',
              touchAction: 'manipulation',
            }}
          >
            Entendi, vou instalar depois
          </button>
        </div>
      </div>
    </div>
  );
};
