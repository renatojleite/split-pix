// Dinheiro sempre em centavos inteiros. Formatação pt-BR sem depender de Intl
// (Hermes no Android pode vir sem dados de locale).

export function formatBRL(cents: number, opts: { sign?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cent = (abs % 100).toString().padStart(2, '0');
  const sign = negative ? '−' : opts.sign && cents > 0 ? '+' : '';
  return `${sign}R$ ${reais},${cent}`;
}

/** Campo de valor estilo "caixa eletrônico": cada dígito digitado entra pela direita. */
export function centsFromInput(text: string): number {
  const digits = text.replace(/\D/g, '').slice(0, 11);
  return digits ? parseInt(digits, 10) : 0;
}

export function inputFromCents(cents: number): string {
  return cents ? formatBRL(cents).replace('R$ ', '') : '';
}

/** 6000 → "60", 3333 → "33,33" */
export function formatPercent(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac ? `${whole},${frac.toString().padStart(2, '0')}` : `${whole}`;
}

/** "33,5" → 3350 */
export function bpFromInput(text: string): number {
  const n = parseFloat(text.replace(',', '.'));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10000, Math.round(n * 100)));
}
