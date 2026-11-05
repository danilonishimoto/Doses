import React, { useState, useEffect, useCallback } from 'react';
import { CloseIcon } from '../../assets/icons';
import {
  notificationService,
  type NotificationPlatformDiagnostics,
} from '../../services/notificationService';
import { notificationOnboardingManager } from '../../services/notificationOnboardingManager';
import type { Account } from '../../types';

export interface NotificationOnboardingModalProps {
  account: Account;
  forceOpen?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  diagnosticsOverride?: NotificationPlatformDiagnostics;
}

type OnboardingModalStatus =
  | 'idle'
  | 'requesting'
  | 'success'
  | 'permission_denied'
  | 'registration_error'
  | 'ios_install_needed';

export const NotificationOnboardingModal: React.FC<NotificationOnboardingModalProps> = ({
  account,
  forceOpen,
  onClose,
  onComplete,
  diagnosticsOverride,
}) => {
  const getEffectiveDiagnostics = useCallback((): NotificationPlatformDiagnostics => {
    return diagnosticsOverride || notificationService.getDiagnostics();
  }, [diagnosticsOverride]);

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (forceOpen) return true;
    if (!account?.id) return false;
    const diag = getEffectiveDiagnostics();
    return notificationOnboardingManager.shouldShowOnboarding({
      accountId: account.id,
      diagnostics: diag,
    });
  });

  const [status, setStatus] = useState<OnboardingModalStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reavalia estado sempre que o accountId mudar ou quando diagnostics forem atualizados
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    if (!account?.id) {
      setIsOpen(false);
      return;
    }

    const diag = getEffectiveDiagnostics();
    const shouldShow = notificationOnboardingManager.shouldShowOnboarding({
      accountId: account.id,
      diagnostics: diag,
    });

    setIsOpen(shouldShow);
    // Reinicializa o status visual para garantir isolamento estrito entre contas
    setStatus(diag.supportStatus === 'ios-browser-requires-install' ? 'ios_install_needed' : 'idle');
    setErrorMessage(null);
  }, [account?.id, forceOpen, getEffectiveDiagnostics]);

  const handleDismiss = useCallback(() => {
    if (account?.id) {
      notificationOnboardingManager.dismissOnboarding(account.id);
    }
    setIsOpen(false);
    onClose?.();
  }, [account?.id, onClose]);

  const handleComplete = useCallback(() => {
    if (account?.id) {
      notificationOnboardingManager.completeOnboarding(account.id);
    }
    setIsOpen(false);
    onComplete?.();
  }, [account?.id, onComplete]);

  // Tecla Escape para acessibilidade
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'requesting') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status, handleDismiss]);

  const handleActivate = async () => {
    const diag = getEffectiveDiagnostics();

    // Se estiver no Safari iOS fora do PWA, orienta a instalação
    if (diag.supportStatus === 'ios-browser-requires-install') {
      setStatus('ios_install_needed');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    try {
      const res = await notificationService.subscribeToPushNotifications({
        hideMedicationNames: true,
      });

      if (res.success) {
        notificationOnboardingManager.completeOnboarding(account.id);
        setStatus('success');
        onComplete?.();

        // Fecha automaticamente após breve confirmação
        setTimeout(() => {
          setIsOpen(false);
        }, 1800);
      } else {
        // Se a permissão foi negada no navegador
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          setStatus('permission_denied');
        } else {
          setStatus('registration_error');
          setErrorMessage(res.error || 'Não foi possível registrar as notificações neste momento.');
        }
      }
    } catch (err: any) {
      setStatus('registration_error');
      setErrorMessage(err.message || 'Erro inesperado ao registrar notificações.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-onboarding-title"
      aria-describedby="notif-onboarding-desc"
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
        if (e.target === e.currentTarget && status !== 'requesting') {
          handleDismiss();
        }
      }}
    >
      <div
        className="notif-onboarding-card"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          maxWidth: 420,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: '#E6F4FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                  stroke="#025492"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#4E6D93',
                  marginBottom: 2,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                Lembretes & Avisos
              </span>
              <h2
                id="notif-onboarding-title"
                style={{
                  margin: 0,
                  fontSize: 19,
                  fontWeight: 700,
                  color: '#000203',
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.25,
                }}
              >
                {status === 'success'
                  ? 'Notificações Ativadas!'
                  : status === 'permission_denied'
                  ? 'Permissão Bloqueada'
                  : status === 'ios_install_needed'
                  ? 'Notificações no iPhone'
                  : 'Não perca nenhum horário!'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={status === 'success' ? handleComplete : handleDismiss}
            aria-label="Fechar e dispensar"
            disabled={status === 'requesting'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 8,
              margin: '-8px -4px 0 0',
              cursor: status === 'requesting' ? 'not-allowed' : 'pointer',
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

        {/* Corpo de Conteúdo */}
        <div
          id="notif-onboarding-desc"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontSize: 14,
            color: '#334155',
            lineHeight: 1.5,
          }}
        >
          {status === 'success' && (
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 16,
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>🎉</span>
              <div>
                <p style={{ fontWeight: 600, color: '#166534', margin: 0 }}>
                  Tudo pronto!
                </p>
                <p style={{ color: '#15803D', margin: '4px 0 0 0', fontSize: 13 }}>
                  Você receberá lembretes diretamente no seu dispositivo nos horários programados para cada medicamento.
                </p>
              </div>
            </div>
          )}

          {status === 'permission_denied' && (
            <div
              style={{
                backgroundColor: '#FFF1F2',
                border: '1px solid #FECDD3',
                borderRadius: 16,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span style={{ fontWeight: 600, color: '#9F1239' }}>
                  Notificações desativadas no navegador
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#881337' }}>
                Para receber avisos dos medicamentos, acesse as configurações do seu navegador ou clique no cadeado ao lado do endereço e autorize as notificações para o Doses.
              </p>
            </div>
          )}

          {status === 'registration_error' && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: 16,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: '#991B1B', fontSize: 13 }}>
                  Falha no registro da notificação
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#B91C1C' }}>
                  {errorMessage || 'Ocorreu uma falha ao comunicar com o servidor. Você pode tentar novamente agora.'}
                </p>
              </div>
            </div>
          )}

          {status === 'ios_install_needed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, color: '#475569' }}>
                No iPhone, o Safari exige que o aplicativo seja adicionado à Tela de Início para poder enviar notificações push:
              </p>
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 16,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#00254E',
                      color: '#FFF',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    1
                  </span>
                  <span style={{ fontSize: 13 }}>
                    Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#00254E',
                      color: '#FFF',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    2
                  </span>
                  <span style={{ fontSize: 13 }}>
                    Selecione <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#00254E',
                      color: '#FFF',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    3
                  </span>
                  <span style={{ fontSize: 13 }}>
                    Abra o Doses pelo novo ícone para ativar seus lembretes!
                  </span>
                </div>
              </div>
            </div>
          )}

          {(status === 'idle' || status === 'requesting' || status === 'registration_error') && (
            <>
              <p style={{ margin: 0, color: '#334155', fontSize: 15 }}>
                Com as notificações ativadas, o Doses avisa você quando chegar a hora de administrar seus medicamentos, mesmo com o app fechado.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 16,
                  padding: '16px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>⏰</span>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#000203',
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      Lembretes pontuais
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748B' }}>
                      Alertas automáticos para cada dose programada.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>📋</span>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#000203',
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      Tranquilidade na rotina
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748B' }}>
                      Não dependa de alarmes manuais para acompanhar seu tratamento.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>👥</span>
                  <div>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#000203',
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      Cuidado da família
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748B' }}>
                      Avisos claros indicando qual perfil deve tomar o medicamento.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé e Ações */}
        <div
          style={{
            padding: '16px 24px 24px 24px',
            borderTop: '1px solid #EEF2F6',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {status === 'success' ? (
            <button
              type="button"
              onClick={handleComplete}
              style={{
                width: '100%',
                height: 52,
                backgroundColor: '#000203',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 20,
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
              }}
            >
              Concluir
            </button>
          ) : status === 'permission_denied' ? (
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                width: '100%',
                height: 52,
                backgroundColor: '#000203',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 20,
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
              }}
            >
              Entendi
            </button>
          ) : status === 'ios_install_needed' ? (
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                width: '100%',
                height: 52,
                backgroundColor: '#000203',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 20,
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
              }}
            >
              Entendi, vou adicionar à tela
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleActivate}
                disabled={status === 'requesting'}
                style={{
                  width: '100%',
                  height: 52,
                  backgroundColor: '#000203',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 20,
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font-heading)',
                  cursor: status === 'requesting' ? 'not-allowed' : 'pointer',
                  opacity: status === 'requesting' ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  touchAction: 'manipulation',
                  transition: 'background-color 0.15s ease, opacity 0.15s ease',
                }}
              >
                {status === 'requesting'
                  ? 'Ativando notificações...'
                  : status === 'registration_error'
                  ? 'Tentar novamente'
                  : 'Ativar notificações'}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                disabled={status === 'requesting'}
                style={{
                  width: '100%',
                  height: 44,
                  backgroundColor: 'transparent',
                  color: '#4E6D93',
                  border: 'none',
                  borderRadius: 16,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-heading)',
                  cursor: status === 'requesting' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation',
                }}
              >
                Agora não
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
