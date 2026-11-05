import { useState, useEffect } from 'react';
import { notificationService, type NotificationPlatformDiagnostics } from '../../services/notificationService';

export function UserNotificationsCard() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hideMedNames, setHideMedNames] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [diag, setDiag] = useState<NotificationPlatformDiagnostics>(notificationService.getDiagnostics());

  useEffect(() => {
    async function checkStatus() {
      const status = await notificationService.getPushSubscriptionStatus();
      setPermission(status.permission);
      setIsSubscribed(status.isSubscribed);
      setDiag(notificationService.getDiagnostics());
    }
    checkStatus();
  }, []);

  const handleActivatePush = async () => {
    setLoading(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const res = await notificationService.subscribeToPushNotifications({
        hideMedicationNames: hideMedNames,
      });

      if (res.success) {
        setIsSubscribed(true);
        setPermission('granted');
        setStatusMessage('Notificações Web Push ativadas com sucesso neste dispositivo!');
      } else {
        setIsError(true);
        setStatusMessage(res.error || 'Falha ao ativar notificações Web Push.');
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err.message || 'Erro inesperado ao ativar notificações.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalTest = async () => {
    const sent = await notificationService.sendLocalTestReminder(
      'Doses — Teste de Notificação',
      hideMedNames
        ? 'Está na hora de um medicamento do seu perfil.'
        : 'Está na hora do medicamento Dipirona (500mg).'
    );

    if (sent) {
      setStatusMessage('Notificação de teste disparada!');
      setIsError(false);
    } else {
      setIsError(true);
      setStatusMessage('Não foi possível disparar o teste. Verifique a permissão do navegador.');
    }
  };

  return (
    <div
      style={{
        borderRadius: 24,
        padding: '20px 24px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔔</span>
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 18,
              color: '#000000',
              margin: 0,
            }}
          >
            Notificações Web Push
          </h3>
        </div>

        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 12,
            backgroundColor: isSubscribed ? '#DCFCE7' : '#F1F5F9',
            color: isSubscribed ? '#166534' : '#64748B',
          }}
        >
          {isSubscribed ? 'Inscrito' : 'Não ativo'}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: '#4E6D93', lineHeight: 1.4 }}>
        Receba avisos pontuais no horário exato dos medicamentos diretamente neste dispositivo.
      </p>

      {/* Alertas contextuais de plataforma */}
      {diag.supportStatus === 'insecure-context' && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            backgroundColor: '#FFFBEB',
            border: '1px solid #FCD34D',
            color: '#92400E',
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <strong>⚠️ Contexto HTTP na rede local detectado:</strong> A especificação Web Push exige origem segura (HTTPS ou localhost) para registrar inscrições push em dispositivos móveis.
        </div>
      )}

      {diag.supportStatus === 'ios-browser-requires-install' && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1E40AF',
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <strong>📱 Requisito do iOS (Safari):</strong> Toque no botão Compartilhar do Safari e selecione <em>"Adicionar à Tela de Início"</em> para instalar o Doses e liberar o Web Push.
        </div>
      )}

      {/* Status da permissão */}
      <div style={{ fontSize: 13, color: '#334155', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>
          <strong>Permissão no navegador:</strong>{' '}
          <span
            style={{
              color:
                permission === 'granted'
                  ? '#16a34a'
                  : permission === 'denied'
                  ? '#dc2626'
                  : '#d97706',
              fontWeight: 600,
            }}
          >
            {permission === 'granted'
              ? 'Concedida'
              : permission === 'denied'
              ? 'Bloqueada (desbloqueie nas configurações do navegador)'
              : 'Pendente'}
          </span>
        </div>
      </div>

      {/* Opção de Privacidade */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          color: '#1E293B',
          cursor: 'pointer',
          padding: '8px 0',
        }}
      >
        <input
          type="checkbox"
          checked={hideMedNames}
          onChange={(e) => setHideMedNames(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--color-brand-primary, #7EDCB9)' }}
        />
        <span>Ocultar nomes dos medicamentos nas notificações (Privacidade)</span>
      </label>

      {/* Botões de Ação */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={handleActivatePush}
          disabled={loading}
          style={{
            height: 48,
            borderRadius: 16,
            border: 'none',
            backgroundColor: isSubscribed ? '#10B981' : '#7EDCB9',
            color: '#000000',
            fontWeight: 600,
            fontSize: 15,
            fontFamily: 'var(--font-heading)',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {loading
            ? 'Processando...'
            : isSubscribed
            ? '✓ Atualizar Inscrição Web Push'
            : 'Ativar Notificações Web Push'}
        </button>

        <button
          type="button"
          onClick={handleLocalTest}
          style={{
            height: 40,
            borderRadius: 12,
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#475569',
            fontWeight: 500,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Disparar teste local imediato
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            backgroundColor: isError ? '#FEE2E2' : '#F0FDF4',
            border: `1px solid ${isError ? '#FCA5A5' : '#BBF7D0'}`,
            color: isError ? '#991B1B' : '#166534',
            fontSize: 13,
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
