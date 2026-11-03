import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  PillIcon,
  ProfilesIcon,
} from '../assets/icons';
import { DoseCard } from '../components/DoseCard';
import { useDoses } from '../hooks/useDosesData';
import { getTodayISO } from '../utils/dateUtils';

export function DashboardPage() {
  const {
    profiles,
    medications,
    doseLogs,
    activeProfileFilter,
    updateDoseStatus,
  } = useDoses();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'administered'>('all');

  useEffect(() => {
    document.title = 'Painel do Dia | Doses';
  }, []);

  const todayISO = getTodayISO();

  const todayDoses = useMemo(() => {
    return doseLogs
      .filter((log) => log.scheduledDate === todayISO)
      .filter((log) =>
        activeProfileFilter === 'all' ? true : log.profileId === activeProfileFilter
      )
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [doseLogs, todayISO, activeProfileFilter]);

  const filteredDoses = useMemo(() => {
    if (statusFilter === 'all') return todayDoses;
    return todayDoses.filter((d) => d.status === statusFilter);
  }, [todayDoses, statusFilter]);

  const pendingCount = todayDoses.filter((d) => d.status === 'pending').length;
  const administeredCount = todayDoses.filter((d) => d.status === 'administered').length;
  const nextPendingDose = todayDoses.find((d) => d.status === 'pending');

  const nextMedication = nextPendingDose
    ? medications.find((m) => m.id === nextPendingDose.medicationId)
    : undefined;
  const nextProfile = nextPendingDose
    ? profiles.find((p) => p.id === nextPendingDose.profileId)
    : undefined;

  return (
    <>
      <section aria-labelledby="main-heading">
        <div className="flex-between">
          <div>
            <h1 id="main-heading" tabIndex={-1}>
              Acompanhamento do Dia
            </h1>
            <p>
              Visualize os horários programados, confirme administrações e previna esquecimentos ou
              duplicidades.
            </p>
          </div>
          <div className="flex-row-gap">
            <Link to="/medicamentos" className="btn btn-secondary btn-sm">
              <PillIcon size={16} />
              <span>Ver medicamentos</span>
            </Link>
            <Link to="/perfis" className="btn btn-secondary btn-sm">
              <ProfilesIcon size={16} />
              <span>Perfis ({profiles.length})</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Resumo de Indicadores do Dia */}
      <section aria-label="Resumo das administrações de hoje" className="stats-grid">
        <div className="card">
          <div className="flex-row-gap" style={{ marginBottom: '0.4rem' }}>
            <span className="badge badge-pending">
              <AlertIcon size={15} />
              <span>Pendentes hoje</span>
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--color-blue-dark)',
            }}
          >
            {pendingCount} {pendingCount === 1 ? 'dose' : 'doses'}
          </p>
          <p className="text-muted">Aguardando confirmação de administração</p>
        </div>

        <div className="card">
          <div className="flex-row-gap" style={{ marginBottom: '0.4rem' }}>
            <span className="badge badge-administered">
              <CheckCircleIcon size={15} />
              <span>Concluídas hoje</span>
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--color-blue-dark)',
            }}
          >
            {administeredCount} de {todayDoses.length}
          </p>
          <p className="text-muted">Doses já registradas com horário e responsável</p>
        </div>

        <div
          className="card"
          style={{
            backgroundColor: 'var(--color-blue-dark)',
            color: '#FFFFFF',
            borderColor: 'var(--color-blue-dark)',
          }}
        >
          <div className="flex-row-gap" style={{ marginBottom: '0.4rem' }}>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(199, 220, 229, 0.2)',
                color: '#FFFFFF',
                borderColor: 'var(--color-blue-light)',
              }}
            >
              <ClockIcon size={15} />
              <span>Próximo horário</span>
            </span>
          </div>
          {nextPendingDose && nextMedication && nextProfile ? (
            <>
              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: 'var(--color-yellow)',
                }}
              >
                {nextPendingDose.scheduledTime} — {nextMedication.name}
              </p>
              <p style={{ color: 'var(--color-blue-gray)', fontSize: '0.86rem' }}>
                Para {nextProfile.name} • {nextMedication.dosage} ({nextMedication.form})
              </p>
            </>
          ) : (
            <>
              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: 'var(--color-green)',
                }}
              >
                Tudo em dia!
              </p>
              <p style={{ color: 'var(--color-blue-gray)', fontSize: '0.86rem' }}>
                Todas as doses programadas para hoje foram concluídas.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Cronograma de Doses Programadas */}
      <section aria-labelledby="schedule-heading" className="card">
        <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
          <div>
            <h2 id="schedule-heading">Cronograma de Hoje</h2>
            <p className="text-muted">
              Toque em &ldquo;Confirmar dose&rdquo; imediatamente após administrar o medicamento.
            </p>
          </div>

          <div
            className="flex-row-gap"
            role="group"
            aria-label="Filtrar cronograma por status da dose"
          >
            <button
              type="button"
              className="profile-pill"
              aria-pressed={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              Todas ({todayDoses.length})
            </button>
            <button
              type="button"
              className="profile-pill"
              aria-pressed={statusFilter === 'pending'}
              onClick={() => setStatusFilter('pending')}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              className="profile-pill"
              aria-pressed={statusFilter === 'administered'}
              onClick={() => setStatusFilter('administered')}
            >
              Administradas ({administeredCount})
            </button>
          </div>
        </div>

        {filteredDoses.length === 0 ? (
          <div className="card-subtle" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <h3>Nenhuma dose encontrada para este filtro</h3>
            <p style={{ marginInline: 'auto', marginTop: '0.35rem' }}>
              Altere o filtro acima ou selecione &ldquo;Todos os perfis&rdquo; no topo da tela.
            </p>
          </div>
        ) : (
          <ul className="dose-list" role="list">
            {filteredDoses.map((dose) => {
              const medication = medications.find((m) => m.id === dose.medicationId);
              const profile = profiles.find((p) => p.id === dose.profileId);
              if (!medication || !profile) return null;

              return (
                <li key={dose.id}>
                  <DoseCard
                    dose={dose}
                    medication={medication}
                    profile={profile}
                    onToggleStatus={(id, nextStatus) => updateDoseStatus(id, nextStatus)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Aviso de Prevenção de Erros e Uso Seguro */}
      <aside className="card-subtle" aria-label="Aviso de uso seguro">
        <div className="flex-row-gap">
          <span className="text-primary-strong">Prevenção de erros:</span>
          <span className="text-muted">
            O Doses é uma ferramenta de organização e acompanhamento de prescrições existentes.
            Sempre confira o rótulo físico do medicamento, a dosagem e o perfil destinatário antes de
            administrar.
          </span>
        </div>
      </aside>
    </>
  );
}
