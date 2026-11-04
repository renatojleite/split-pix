// Prévia da divisão no formulário. Espelha public.allocate_cents e
// public.effective_rule do banco, que continua sendo a fonte da verdade.

import type { Rule, SplitMode } from './types';

export type Share = { memberId: string; cents: number; bp: number };

export function allocateCents(
  amount: number,
  members: string[],
  bps: number[],
  payer: string,
): Share[] {
  if (members.length === 0) throw new Error('Divisão sem participantes');
  const totalBp = bps.reduce((a, b) => a + b, 0);
  if (totalBp <= 0) throw new Error('Percentuais somam zero');

  const cents = bps.map((bp) => Math.floor((amount * bp) / totalBp));
  const remainder = amount - cents.reduce((a, b) => a + b, 0);

  let target = members.indexOf(payer);
  if (target === -1 || bps[target] === 0) {
    target = 0;
    for (let i = 1; i < bps.length; i++) if (bps[i] > bps[target]) target = i;
  }
  cents[target] += remainder;

  return members.map((memberId, i) => ({
    memberId,
    cents: cents[i],
    bp: Math.round((bps[i] * 10000) / totalBp),
  }));
}

/** Regra vigente: a da categoria vence o padrão; dentro de cada uma, a mais recente até a data. */
export function effectiveRule(rules: Rule[], categoryId: string | null, on: string): Rule | null {
  const valid = rules.filter((r) => r.effective_from <= on);
  const latest = (list: Rule[]) =>
    list.sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0] ?? null;
  if (categoryId) {
    const own = latest(valid.filter((r) => r.category_id === categoryId));
    if (own) return own;
  }
  return latest(valid.filter((r) => r.category_id === null));
}

export type SplitInput = {
  mode: SplitMode;
  amount: number;
  payer: string;
  memberIds: string[]; // ordem de exibição
  participants: Set<string>; // usados em 'default' e 'equal'
  rule: Rule | null; // regra vigente (modo 'default')
  percent: Record<string, number>; // bp por membro (modo 'percent')
  exact: Record<string, number>; // centavos por membro (modo 'exact')
};

export type SplitPreview = { shares: Share[]; error: string | null };

export function previewSplit(input: SplitInput): SplitPreview {
  const { mode, amount, payer, memberIds, participants, rule } = input;
  const empty = memberIds.map((memberId) => ({ memberId, cents: 0, bp: 0 }));
  const fill = (partial: Share[]) =>
    memberIds.map((id) => partial.find((s) => s.memberId === id) ?? { memberId: id, cents: 0, bp: 0 });

  if (mode === 'exact') {
    const shares = memberIds.map((id) => ({
      memberId: id,
      cents: input.exact[id] ?? 0,
      bp: amount ? Math.round(((input.exact[id] ?? 0) * 10000) / amount) : 0,
    }));
    const sum = shares.reduce((a, s) => a + s.cents, 0);
    return { shares, error: sum === amount ? null : `Falta distribuir ${centsDiff(amount - sum)}` };
  }

  if (mode === 'percent') {
    const ids = memberIds.filter((id) => (input.percent[id] ?? 0) > 0);
    const sum = memberIds.reduce((a, id) => a + (input.percent[id] ?? 0), 0);
    if (sum !== 10000) return { shares: empty, error: `Percentuais somam ${sum / 100}%, precisa ser 100%` };
    if (!amount) return { shares: empty, error: null };
    return { shares: fill(allocateCents(amount, ids, ids.map((id) => input.percent[id]), payer)), error: null };
  }

  let ids: string[];
  let bps: number[];
  if (mode === 'equal') {
    ids = memberIds.filter((id) => participants.has(id));
    bps = ids.map(() => 1);
  } else {
    const ruleShares = (rule?.shares ?? []).filter(
      (s) => s.basis_points > 0 && participants.has(s.member_id),
    );
    ids = ruleShares.map((s) => s.member_id);
    bps = ruleShares.map((s) => s.basis_points);
  }
  if (ids.length === 0) return { shares: empty, error: 'Escolha ao menos uma pessoa' };
  if (!amount) {
    const total = bps.reduce((a, b) => a + b, 0);
    return {
      shares: fill(ids.map((id, i) => ({ memberId: id, cents: 0, bp: Math.round((bps[i] * 10000) / total) }))),
      error: null,
    };
  }
  return { shares: fill(allocateCents(amount, ids, bps, payer)), error: null };
}

function centsDiff(c: number) {
  const sign = c < 0 ? '−' : '';
  const abs = Math.abs(c);
  return `${sign}R$ ${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, '0')}`;
}

/** Quem paga quem para zerar (guloso: maior devedor paga maior credor). */
export function settleUp(balances: { memberId: string; cents: number }[]) {
  const debtors = balances.filter((b) => b.cents < 0).map((b) => ({ ...b, cents: -b.cents }));
  const creditors = balances.filter((b) => b.cents > 0).map((b) => ({ ...b }));
  debtors.sort((a, b) => b.cents - a.cents);
  creditors.sort((a, b) => b.cents - a.cents);
  const out: { from: string; to: string; cents: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].cents, creditors[j].cents);
    if (pay > 0) out.push({ from: debtors[i].memberId, to: creditors[j].memberId, cents: pay });
    debtors[i].cents -= pay;
    creditors[j].cents -= pay;
    if (debtors[i].cents === 0) i++;
    if (creditors[j].cents === 0) j++;
  }
  return out;
}
