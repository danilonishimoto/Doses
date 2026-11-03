import { useEffect, useId, useState } from 'react';
import {
  AlertIcon,
  BellIcon,
  CheckCircleIcon,
} from '../assets/icons';
import { useDoses } from '../hooks/useDosesData';
import { usePWAStatus } from '../hooks/usePWAStatus';
import { notificationService } from '../services/notificationService';
import { storageService } from '../services/storageService';

export function SettingsPage() {
  const {
    profiles,
    medications,
    doseLogs,
    settings,
    pendingSync,
    lastUpdatedAt,
    updateSettings,
    resetDemoData,
    triggerToast,
  } = useDoses();

  const { isOnline, isStandalone, canInstallNatively, promptInstall } = usePWAStatus();
  const formId = useId();

  const [diagnostics, setDiagnostics] = useState(() =>
    notificationService.getDiagnostics()
  );

  useEffect(() => {
    document.title = 'Configurações e Notificações | Doses';
  }, []);

  const handleRequestNotificationPermission = async () => {
    const result = await notificationService.requestUserPermission();
    setDiagnostics(notificationService.getDiagnostics());

    if (result === 'granted') {
      updateSettings({
        notifications: {
          ...settings.notifications,
          enabled: true,
        },
      });
      triggerToast('Permissão de notificações concedida pelo navegador.');
    } else if (result === 'denied') {
      triggerToast(
        'Permissão negada no navegador. Você pode alterar isso nas configurações do site.'
      );
    } else {
      triggerToast('Solicitação de permissão encerrada sem confirmação.');
    }
  };

  const handleTestLocalNotification = async () => {
    const sent = await notificationService.sendLocalTestReminder(
      'Lembrete Doses — Horário Programado',
      'Exemplo de aviso: Losartana Potássica 50 mg para Sr. Artur Costa.'
    );
    if (sent) {
      triggerToast('Notificação local de teste enviada com sucesso!');
    } else {
      triggerToast(
        'Não foi possível disparar a notificação. Verifique se a permissão está ativa.'
      );
    }
  };

  const handleExportJSON = () => {
    const jsonString = storageService.exportDatabaseJSON({
      profiles,
      medications,
      doseLogs,
      settings,
    });
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `doses-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast('Arquivo JSON exportado com sucesso.');
  };

  return (
    <>
      <section aria-labelledby="main-heading">
        <div>
          <h1 id="main-heading" tabIndex={-1}>
            Configurações e Preferências
          </h1>
          <p>
            Gerencie alertas de horários, instalação do Progressive Web App (PWA) e armazenamento
            local de dados.
          </p>
        </div>
      </section>

      {/* Seção 1: Notificações e Alertas */}
      <section aria-labelledby="notif-heading" className="card">
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <div className="flex-row-gap">
            <BellIcon size={22} />
            <h2 id="notif-heading">Notificações e Lembretes de Horário</h2>
          </div>

          {diagnostics.permission === 'granted' ? (
            <span className="badge badge-administered">
              <CheckCircleIcon size={15} />
              <span>Permissão ativa no navegador</span>
            </span>
          ) : (
            <span className="badge badge-pending">
              <AlertIcon size={15} />
              <span>
                Status da API:{' '}
                {diagnostics.permission === 'denied'
                  ? 'Bloqueada pelo usuário'
                  : diagnostics.permission === 'default'
                    ? 'Aguardando autorização'
                    : 'Não suportada neste modo'}
              </span>
            </span>
          )}
        </div>

        <p style={{ marginBottom: '1rem' }}>
          O Doses utiliza a <strong>Web Notifications API</strong> mediante sua autorização
          explícita. A arquitetura já está preparada para futura integração com servidores Web Push.
        </p>

        {/* Aviso Transparente sobre Limitações de PWA e iOS */}
        <div
          className="card-subtle"
          style={{
            backgroundColor: 'var(--color-status-warning-bg)',
            borderColor: 'var(--color-status-warning-border)',
            marginBottom: '1.25rem',
          }}
        >
          <div className="flex-row-gap" style={{ marginBottom: '0.35rem' }}>
            <AlertIcon size={16} />
            <strong style={{ color: 'var(--color-blue-dark)', fontSize: '0.9rem' }}>
              Importante sobre confiabilidade de notificações em PWAs (especialmente iOS):
            </strong>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--color-blue-dark)' }}>
            Notificações puramente locais dependem de o aplicativo estar aberto ou em memória no
            navegador e <strong>não devem ser consideradas garantidamente confiáveis</strong> quando
            o aplicativo estiver totalmente fechado. Em dispositivos iOS (iPhone/iPad), o suporte a
            notificações web exige iOS 16.4+ e que o aplicativo esteja instalado na Tela de Início
            (modo standalone). Para medicamentos críticos, mantenha sempre um alarme nativo do
            sistema como apoio até que o serviço externo de Web Push esteja conectado.
          </p>
        </div>

        <div className="flex-row-gap" style={{ marginBottom: '1.25rem' }}>
          {diagnostics.permission !== 'granted' &&
            diagnostics.supportStatus === 'supported' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRequestNotificationPermission}
              >
                <BellIcon size={18} />
                <span>Autorizar notificações neste dispositivo</span>
              </button>
            )}

          {diagnostics.permission === 'granted' && (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleTestLocalNotification}
            >
              <BellIcon size={18} />
              <span>Testar notificação agora</span>
            </button>
          )}
        </div>

        <div className="stats-grid">
          <div className="form-field">
            <label htmlFor={`${formId}-advance`} className="form-label">
              Antecedência do lembrete
            </label>
            <select
              id={`${formId}-advance`}
              className="form-select"
              value={settings.notifications.advanceReminderMinutes}
              onChange={(e) =>
                updateSettings({
                  notifications: {
                    ...settings.notifications,
                    advanceReminderMinutes: Number(e.target.value),
                  },
                })
              }
            >
              <option value={0}>No horário exato da dose</option>
              <option value={5}>5 minutos antes</option>
              <option value={10}>10 minutos antes</option>
              <option value={15}>15 minutos antes</option>
              <option value={30}>30 minutos antes</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-summary`} className="form-label">
              Horário do resumo matinal
            </label>
            <input
              id={`${formId}-summary`}
              type="time"
              className="form-input"
              value={settings.notifications.dailySummaryTime}
              onChange={(e) =>
                updateSettings({
                  notifications: {
                    ...settings.notifications,
                    dailySummaryTime: e.target.value,
                  },
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Seção 2: Diagnóstico PWA e Instalação */}
      <section aria-labelledby="pwa-heading" className="card">
        <h2 id="pwa-heading" style={{ marginBottom: '0.5rem' }}>
          Aplicativo Instalável (PWA) e Funcionamento Offline
        </h2>
        <p style={{ marginBottom: '1rem' }}>
          O Doses armazena seus recursos visuais e registros localmente para que você possa
          consultar horários e registrar administrações mesmo sem conexão com a internet.
        </p>

        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          <div className="card-subtle">
            <span className="text-muted">Status de Conexão</span>
            <p className="text-primary-strong" style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>
              {isOnline ? 'Online (Conectado)' : 'Offline (Operando via Service Worker)'}
            </p>
          </div>

          <div className="card-subtle">
            <span className="text-muted">Modo de Exibição</span>
            <p className="text-primary-strong" style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>
              {isStandalone
                ? 'Instalado (Standalone)'
                : 'Aberto no navegador (Instalável)'}
            </p>
          </div>

          <div className="card-subtle">
            <span className="text-muted">Fila de Sincronização Futura</span>
            <p className="text-primary-strong" style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>
              {pendingSync
                ? 'Alterações locais prontas para sync'
                : 'Sincronizado com base inicial'}
            </p>
          </div>
        </div>

        {canInstallNatively && (
          <button type="button" className="btn btn-primary" onClick={promptInstall}>
            Instalar Doses na Tela Inicial
          </button>
        )}
      </section>

      {/* Seção 3: Dados Locais (JSON) e Restauração */}
      <section aria-labelledby="data-heading" className="card">
        <h2 id="data-heading" style={{ marginBottom: '0.5rem' }}>
          Armazenamento Local (JSON) e Portabilidade
        </h2>
        <p style={{ marginBottom: '1rem' }}>
          Última atualização salva localmente:{' '}
          <strong>{new Date(lastUpdatedAt).toLocaleString('pt-BR')}</strong>. Você pode exportar a
          estrutura JSON atual ou restaurar os dados fictícios originais de demonstração.
        </p>

        <div className="flex-row-gap">
          <button type="button" className="btn btn-secondary" onClick={handleExportJSON}>
            Exportar dados (.json)
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetDemoData}>
            Restaurar dados iniciais de demonstração
          </button>
        </div>
      </section>
    </>
  );
}
