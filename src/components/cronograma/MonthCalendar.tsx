import { useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../../assets/icons';
import type { Profile } from '../../types';

interface MonthCalendarProps {
  currentMonthDate: Date;
  selectedDate: Date;
  todayDate: Date;
  activeProfile?: Profile | null;
  getMedicationCount?: (date: Date) => number;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  medicationCount: number;
}

export function MonthCalendar({
  currentMonthDate,
  selectedDate,
  todayDate,
  activeProfile: _activeProfile,
  getMedicationCount,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
}: MonthCalendarProps) {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const monthTitle = `${MONTH_NAMES[month]} ${year}`;

  const todayFormatted = `${String(todayDate.getDate()).padStart(2, '0')}/${String(
    todayDate.getMonth() + 1
  ).padStart(2, '0')}`;

  // Calcula a matriz dos dias do mês
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const days: CalendarDay[] = [];

    // Primeiro dia da semana do mês (0 = Domingo)
    const firstDayIndex = new Date(year, month, 1).getDay();

    // Total de dias no mês atual
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Total de dias no mês anterior
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Dias do mês anterior para preencher a primeira semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const isSelected =
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
      const isToday =
        d.getDate() === todayDate.getDate() &&
        d.getMonth() === todayDate.getMonth() &&
        d.getFullYear() === todayDate.getFullYear();

      days.push({
        date: d,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday,
        isSelected,
        medicationCount: getMedicationCount ? getMedicationCount(d) : 0,
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const isSelected =
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
      const isToday =
        d.getDate() === todayDate.getDate() &&
        d.getMonth() === todayDate.getMonth() &&
        d.getFullYear() === todayDate.getFullYear();

      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: true,
        isToday,
        isSelected,
        medicationCount: getMedicationCount ? getMedicationCount(d) : 0,
      });
    }

    // Dias do próximo mês para completar as semanas (múltiplos de 7)
    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      const isSelected =
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
      const isToday =
        d.getDate() === todayDate.getDate() &&
        d.getMonth() === todayDate.getMonth() &&
        d.getFullYear() === todayDate.getFullYear();

      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        isToday,
        isSelected,
        medicationCount: getMedicationCount ? getMedicationCount(d) : 0,
      });
    }

    return days;
  }, [year, month, selectedDate, todayDate, getMedicationCount]);

  return (
    <section
      className="month-calendar-container"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
      aria-label={`Calendário de ${monthTitle}`}
    >
      {/* Barra superior de seleção de mês (Figma 241:7651) */}
      <div
        className="month-selection-row"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Mês anterior"
          className="calendar-nav-btn"
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            borderRadius: 12,
            color: '#000000',
          }}
        >
          <ChevronLeftIcon size={24} />
        </button>

        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 24,
            color: '#000000',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {monthTitle}
        </h2>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Próximo mês"
          className="calendar-nav-btn"
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            borderRadius: 12,
            color: '#000000',
          }}
        >
          <ChevronRightIcon size={24} />
        </button>
      </div>

      {/* Grade mensal (Figma 241:7661) */}
      <div
        className="calendar-grid"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Cabeçalho dos dias da semana (Dom, Seg, Ter...) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            height: 28,
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {WEEKDAY_NAMES.map((name) => (
            <span
              key={name}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 14,
                color: '#536579',
                userSelect: 'none',
              }}
            >
              {name}
            </span>
          ))}
        </div>

        {/* Células dos dias em grade de 7 colunas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            rowGap: 4,
          }}
        >
          {calendarDays.map((dayItem, idx) => {
            const isSelected = dayItem.isSelected;
            const isCurrentMonth = dayItem.isCurrentMonth;
            const isToday = dayItem.isToday;

            return (
              <button
                key={`${dayItem.date.toISOString()}-${idx}`}
                type="button"
                onClick={() => onSelectDate(dayItem.date)}
                aria-label={`${dayItem.dayNumber} de ${MONTH_NAMES[dayItem.date.getMonth()]}${
                  isToday ? ', hoje' : ''
                }${dayItem.medicationCount > 0 ? `, ${dayItem.medicationCount} medicações` : ''}`}
                aria-pressed={isSelected}
                style={{
                  height: 52,
                  borderRadius: 22,
                  border: isToday && !isSelected ? '1.5px solid #4E6D93' : 'none',
                  backgroundColor: isSelected
                    ? '#000000'
                    : isCurrentMonth
                    ? '#FFFFFF'
                    : '#FAFCFE',
                  color: isSelected
                    ? '#FFFFFF'
                    : isCurrentMonth
                    ? '#000000'
                    : '#A0AEC0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                  transition: 'background-color 0.15s ease, transform 0.1s ease',
                  position: 'relative',
                }}
              >
                {/* Número do dia */}
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  {dayItem.dayNumber}
                </span>

                {/* Bolinhas indicadoras de medicação (Figma: até 4 bolinhas) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    height: 5,
                    minHeight: 5,
                  }}
                  aria-hidden="true"
                >
                  {dayItem.medicationCount > 0 &&
                    Array.from({ length: Math.min(dayItem.medicationCount, 4) }).map((_, dIdx) => (
                      <span
                        key={dIdx}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          backgroundColor: isSelected ? '#C8E7FF' : '#4E6D93',
                          display: 'inline-block',
                        }}
                      />
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Referência e legenda inferior (Figma 241:7895) */}
      <div
        className="calendar-reference-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 4,
          fontSize: 14,
          fontFamily: 'var(--font-body)',
          color: '#536579',
        }}
      >
        <button
          type="button"
          onClick={onGoToToday}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: '#000000',
            fontWeight: 600,
            fontSize: 14,
            fontFamily: 'var(--font-body)',
          }}
          aria-label="Ir para a data de hoje"
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#4E6D93',
              display: 'inline-block',
            }}
          />
          Hoje: {todayFormatted}
        </button>

        <span>Cada ponto: 1 medicação</span>
      </div>
    </section>
  );
}
