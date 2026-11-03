export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayISO(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatReadableDate(isoDate?: string): string {
  if (!isoDate) return 'Indeterminado';
  const today = getTodayISO();
  const yesterday = getYesterdayISO();

  if (isoDate === today) return 'Hoje';
  if (isoDate === yesterday) return 'Ontem';

  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts.map(Number);
  const dateObj = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dateObj);
}

export function formatFullHeaderDate(): string {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getPeriodOfDay(timeHHMM: string): 'Manhã' | 'Tarde' | 'Noite' {
  const [hourStr] = timeHHMM.split(':');
  const hour = Number(hourStr);
  if (hour >= 5 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  return 'Noite';
}
