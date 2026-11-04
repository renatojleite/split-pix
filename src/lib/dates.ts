// Datas como string 'YYYY-MM-DD' (o que o Postgres guarda em `date`), sem fuso.

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = (n: number) => n.toString().padStart(2, '0');

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

export function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = today();
  if (iso === t) return 'Hoje';
  if (iso === addDays(t, -1)) return 'Ontem';
  return `${d} ${SHORT[m - 1]} ${y}`;
}

/** Soma n meses mantendo o dia; se o mês não tem o dia, usa o último (igual ao Postgres). */
export function addMonthsKeepDay(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/** Datas de uma série recorrente a partir da primeira. */
export function seriesDates(first: string, count: number, every: 'month' | 'week'): string[] {
  return Array.from({ length: count }, (_, i) =>
    every === 'week' ? addDays(first, 7 * i) : addMonthsKeepDay(first, i),
  );
}

export function dayMonth(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT[m - 1]}`;
}
