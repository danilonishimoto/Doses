import { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { MonthCalendar } from '../../components/cronograma/MonthCalendar';
import { WeekCalendar } from '../../components/cronograma/WeekCalendar';
import { MedicationCard } from '../../components/home/MedicationCard';
import { useDailyDoses, getTodaySaoPauloDate } from '../../features/medications/hooks/useDailyDoses';
import { useMonthMedicationCounts, formatDateToDateKey } from '../../features/medications/hooks/useMonthMedicationCounts';
import { FileTextIcon } from '../../assets/icons';

type CalendarViewMode = 'week' | 'month';

const WEEKDAYS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const MONTH_NAMES_LOWER = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function CronogramaScreen() {
  const { activeProfile } = useApp();

  // Data de referência real de hoje no fuso oficial America/Sao_Paulo
  const [todayDate] = useState(() => {
    const todayStr = getTodaySaoPauloDate();
    const [y, m, d] = todayStr.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  });

  // Mês em exibição no calendário mensal
  const [currentMonthDate, setCurrentMonthDate] = useState(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  );

  // Data selecionada pelo usuário (padrão inicial: hoje)
  const [selectedDate, setSelectedDate] = useState(todayDate);

  // Modo de visualização: 'month' (padrão Figma) ou 'week'
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  const selectedDateKey = useMemo(() => formatDateToDateKey(selectedDate), [selectedDate]);

  // Busca ocorrências reais do dia selecionado pelo mesmo endpoint/contrato da HomeScreen
  const {
    doses: currentMedications,
    isLoading,
    toggleDoseStatus,
  } = useDailyDoses({
    activeProfile,
    targetDate: selectedDateKey,
  });

  // Indicadores reais de pontos por dia no calendário mensal
  const { getMedicationCount } = useMonthMedicationCounts({
    activeProfile,
    currentMonthDate,
  });

  const handleSelectDate = (newDate: Date) => {
    setSelectedDate(newDate);
    // Se o dia selecionado for de outro mês, sincroniza o mês exibido
    if (newDate.getMonth() !== currentMonthDate.getMonth() || newDate.getFullYear() !== currentMonthDate.getFullYear()) {
      setCurrentMonthDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePrevWeek = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleGoToToday = () => {
    setSelectedDate(todayDate);
    setCurrentMonthDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  };

  // Montagem do texto do resumo (ex: "Hoje, 19 de outubro · 3 medicações")
  const isSelectedToday =
    selectedDate.getDate() === todayDate.getDate() &&
    selectedDate.getMonth() === todayDate.getMonth() &&
    selectedDate.getFullYear() === todayDate.getFullYear();

  const dayOfWeekStr = WEEKDAYS_FULL[selectedDate.getDay()];
  const dayNum = selectedDate.getDate();
  const monthName = MONTH_NAMES_LOWER[selectedDate.getMonth()];
  const countStr =
    currentMedications.length === 1
      ? '1 medicação'
      : `${currentMedications.length} medicações`;

  const summarySubtitle = isSelectedToday
    ? `Hoje, ${dayNum} de ${monthName} · ${countStr}`
    : `${dayOfWeekStr}, ${dayNum} de ${monthName} · ${countStr}`;

  return (
    <div
      className="cronograma-screen"
      style={{
        width: '100%',
        maxWidth: 402,
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      aria-label="Tela de Cronograma de Medicamentos"
    >
      <div
        className="cronograma-content"
        style={{
          width: '100%',
          padding: '24px 24px calc(140px + env(safe-area-inset-bottom, 0px)) 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Título da tela */}
        <header>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              fontSize: 36,
              lineHeight: 1.2,
              color: '#000000',
              margin: 0,
            }}
          >
            Cronograma
          </h1>
        </header>

        {/* Alternador de Modo: Semana / Mês (Figma 241:7637) */}
        <div
          className="calendar-mode-toggle"
          role="tablist"
          aria-label="Visualização do calendário"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('week')}
            aria-pressed={viewMode === 'week'}
            style={{
              backgroundColor: viewMode === 'week' ? '#000000' : '#FFFFFF',
              color: viewMode === 'week' ? '#FFFFFF' : '#000000',
              border: '1px solid #000000',
              borderRadius: 999,
              padding: '4px 14px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            aria-pressed={viewMode === 'month'}
            style={{
              backgroundColor: viewMode === 'month' ? '#000000' : '#FFFFFF',
              color: viewMode === 'month' ? '#FFFFFF' : '#000000',
              border: '1px solid #000000',
              borderRadius: 999,
              padding: '4px 14px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            Mês
          </button>
        </div>

        {/* Visualização de Calendário */}
        {viewMode === 'month' ? (
          <MonthCalendar
            currentMonthDate={currentMonthDate}
            selectedDate={selectedDate}
            todayDate={todayDate}
            activeProfile={activeProfile}
            getMedicationCount={getMedicationCount}
            onSelectDate={handleSelectDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onGoToToday={handleGoToToday}
          />
        ) : (
          <WeekCalendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
          />
        )}

        {/* Programação do Dia Selecionado (Figma 241:7900) */}
        <section
          className="daily-schedule-section"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginTop: 8,
          }}
          aria-label="Medicações do dia selecionado"
        >
          {/* Resumo da data */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 32,
                fontWeight: 400,
                color: '#000000',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Medicações do dia
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                color: '#536579',
                margin: 0,
              }}
            >
              {summarySubtitle}
            </p>
          </div>

          {/* Carregamento */}
          {isLoading && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: '#536579',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
              }}
            >
              Carregando programação do dia...
            </div>
          )}

          {/* Lista de medicamentos ou estado vazio */}
          {!isLoading && currentMedications.length === 0 ? (
            <div
              className="empty-day-state"
              style={{
                padding: '36px 20px',
                backgroundColor: '#F8FAFC',
                borderRadius: 20,
                border: '1px dashed #CBD5E1',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: '#E6F4FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4E6D93',
                }}
              >
                <FileTextIcon size={24} />
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#000000',
                  margin: 0,
                }}
              >
                Nenhuma medicação programada
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: '#64748B',
                  margin: 0,
                  maxWidth: 280,
                }}
              >
                Não há medicamentos agendados para este dia para{' '}
                {activeProfile?.name || 'este perfil'}.
              </p>
            </div>
          ) : (
            !isLoading && (
              <div
                className="medications-schedule-list"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {currentMedications.map((item) => (
                  <MedicationCard
                    key={item.id}
                    item={item}
                    onToggleStatus={toggleDoseStatus}
                  />
                ))}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
