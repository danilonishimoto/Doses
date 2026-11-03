import { useEffect, useMemo, useState } from 'react';
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  PetPawIcon,
} from '../assets/icons';
import { useDoses } from '../hooks/useDosesData';
import { formatReadableDate, getTodayISO, getYesterdayISO } from '../utils/dateUtils';

export function HistoryPage() {
  const { profiles, medications, doseLogs, activeProfileFilter } = useDoses();
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday'>('all');

  useEffect(() => {
    document.title = 'Histórico de Administrações | Doses';
  }, []);

  const todayISO = getTodayISO();
  const yesterdayISO = getYesterdayISO();

  const filteredLogs = useMemo(() => {
    return doseLogs
      .filter((log) =>
        activeProfileFilter === 'all' ? true : log.profileId === activeProfileFilter
      )
      .filter((log) => {
        if (dateFilter === 'today') return log.scheduledDate === todayISO;
        if (dateFilter === 'yesterday') return log.scheduledDate === yesterdayISO;
        return true;
      })
      .sort((a, b) => {
        const dateCmp = b.scheduledDate.localeCompare(a.scheduledDate);
        if (dateCmp !== 0) return dateCmp;
        return b.scheduledTime.localeCompare(a.scheduledTime);
      });
  }, [doseLogs, activeProfileFilter, dateFilter, todayISO, yesterdayISO]);

  const totalAdministered = filteredLogs.filter((l) => l.status === 'administered').length;
  const adherenceRate =
    filteredLogs.length > 0
      ? Math.round((totalAdministered / filteredLogs.length) * 100)
      : 0;

  return (
    <>
      <section aria-labelledby="main-heading">
        <div className="flex-between">
          <div>
            <h1 id="main-heading" tabIndex={-1}>
              Histórico de Administrações
            </h1>
            <p>
              Acompanhe o registro cronológico de todas as doses administradas, pendentes ou não
              realizadas.
            </p>
          </div>

          <div
            className="flex-row-gap"
            role="group"
            aria-label="Filtrar histórico por período"
          >
            <button
              type="button"
              className="profile-pill"
              aria-pressed={dateFilter === 'all'}
              onClick={() => setDateFilter('all')}
            >
              Todos os dias
            </button>
            <button
              type="button"
              className="profile-pill"
              aria-pressed={dateFilter === 'today'}
              onClick={() => setDateFilter('today')}
            >
              Hoje
            </button>
            <button
              type="button"
              className="profile-pill"
              aria-pressed={dateFilter === 'yesterday'}
              onClick={() => setDateFilter('yesterday')}
            >
              Ontem
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Indicadores do período selecionado" className="stats-grid">
        <div className="card">
          <span className="text-muted">Registros no filtro</span>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.8rem',
              fontWeight: 800,
              color: 'var(--color-blue-dark)',
            }}
          >
            {filteredLogs.length} registros
          </p>
        </div>

        <div className="card">
          <span className="text-muted">Doses confirmadas</span>
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.8rem',
              fontWeight: 800,
              color: 'var(--color-blue-dark)',
            }}
          >
            {totalAdministered} ({adherenceRate}% concluído)
          </p>
        </div>
      </section>

      <section aria-labelledby="history-table-heading">
        <h2 id="history-table-heading" style={{ marginBottom: '0.85rem' }}>
          Tabela de Registros
        </h2>

        <div className="table-container">
          <table className="data-table">
            <caption className="visually-hidden">
              Registros cronológicos de doses de medicamentos por perfil, horário e status
            </caption>
            <thead>
              <tr>
                <th scope="col">Data e Horário</th>
                <th scope="col">Perfil</th>
                <th scope="col">Medicamento e Dose</th>
                <th scope="col">Status</th>
                <th scope="col">Observações / Registro</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const med = medications.find((m) => m.id === log.medicationId);
                const prof = profiles.find((p) => p.id === log.profileId);

                return (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--color-blue-dark)' }}>
                        {formatReadableDate(log.scheduledDate)}
                      </div>
                      <div className="flex-row-gap text-muted" style={{ fontSize: '0.8rem' }}>
                        <ClockIcon size={13} />
                        <span>Programado: {log.scheduledTime}</span>
                      </div>
                    </td>
                    <td>
                      {prof ? (
                        <span className="badge badge-neutral">
                          <span
                            className="avatar-dot"
                            style={{ backgroundColor: prof.avatarColor }}
                            aria-hidden="true"
                          />
                          {prof.type === 'pet' && <PetPawIcon size={13} />}
                          <span>{prof.name}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--color-blue-dark)' }}>
                        {med?.name || 'Medicamento removido'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {med ? `${med.dosage} (${med.form})` : ''}
                      </div>
                    </td>
                    <td>
                      {log.status === 'administered' && (
                        <span className="badge badge-administered">
                          <CheckCircleIcon size={14} />
                          <span>Administrado ({log.administeredAt})</span>
                        </span>
                      )}
                      {log.status === 'pending' && (
                        <span className="badge badge-pending">
                          <AlertIcon size={14} />
                          <span>Pendente</span>
                        </span>
                      )}
                      {log.status === 'skipped' && (
                        <span className="badge badge-neutral">
                          <span>Não administrado</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.84rem', color: 'var(--color-gray)' }}>
                        {log.notes || (log.administeredBy ? `Por ${log.administeredBy}` : '—')}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
