import { ChevronLeftIcon, ChevronRightIcon } from '../../assets/icons';

interface WeekCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function WeekCalendar({
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
}: WeekCalendarProps) {
  // Gera os 5 dias centrados ao redor do dia selecionado (ou da semana atual)
  const days = [-2, -1, 0, 1, 2].map((offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    return d;
  });

  return (
    <div
      className="week-calendar-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        boxSizing: 'border-box',
      }}
      aria-label="Navegação semanal do cronograma"
    >
      <button
        type="button"
        onClick={onPrevWeek}
        aria-label="Semana anterior"
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: '#000000',
        }}
      >
        <ChevronLeftIcon size={24} />
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flex: 1,
        }}
      >
        {days.map((d) => {
          const isSelected =
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear();

          const dayOfWeek = WEEKDAY_SHORT[d.getDay()];
          const dayNum = d.getDate();

          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelectDate(d)}
              aria-label={`${dayOfWeek}, ${dayNum}`}
              aria-pressed={isSelected}
              style={{
                backgroundColor: isSelected ? '#B1DBFB' : '#E6F4FF',
                height: isSelected ? 104 : 92,
                width: isSelected ? 64 : 56,
                borderRadius: isSelected ? 36 : 30,
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                padding: 0,
                color: '#000000',
                outline: 'none',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: isSelected ? 18 : 15,
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                {dayOfWeek}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: isSelected ? 34 : 28,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {dayNum}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNextWeek}
        aria-label="Próxima semana"
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: '#000000',
        }}
      >
        <ChevronRightIcon size={24} />
      </button>
    </div>
  );
}
