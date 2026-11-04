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
