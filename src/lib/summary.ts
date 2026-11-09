// Números da aba Resumo, calculados a partir dos lançamentos já carregados.

import { settleUp } from './split.ts';
import type { Category, Entry, Member } from './types';

export type PersonSummary = {
  memberId: string;
  paid: number; // despesas que pagou
  share: number; // sua parte nas despesas
  received: number; // receitas que recebeu
  incomeShare: number; // sua parte nas receitas
  sent: number; // acertos que enviou
  got: number; // acertos que recebeu
  balance: number; // positivo = tem a receber
};

export type CategorySummary = {
  categoryId: string | null;
  name: string;
  emoji: string;
  cents: number;
  ratio: number; // fração do gasto total
  byMember: Record<string, number>;
};

export type Summary = {
  spent: number;
  income: number;
  net: number; // entradas − gastos
  pending: number; // quanto falta acertar entre as pessoas
  transfers: { from: string; to: string; cents: number }[];
  people: PersonSummary[];
  categories: CategorySummary[];
};

/** Mostra quem está no grupo e quem saiu mas tem movimento no período (histórico). */
export function shownPeople(people: PersonSummary[], members: Member[]): PersonSummary[] {
  return people.filter((p) => {
    const m = members.find((x) => x.id === p.memberId);
    return (m && !m.left_at) || p.paid || p.share || p.received || p.incomeShare || p.sent || p.got;
  });
}

export function summarize(entries: Entry[], members: Member[], categories: Category[]): Summary {
  const people = new Map<string, PersonSummary>(
    members.map((m) => [m.id, { memberId: m.id, paid: 0, share: 0, received: 0, incomeShare: 0, sent: 0, got: 0, balance: 0 }]),
  );
  const cats = new Map<string, CategorySummary>();
  let spent = 0;
  let income = 0;

  for (const e of entries) {
    const payer = people.get(e.paid_by);
    if (e.type === 'expense') {
      spent += e.amount_cents;
      if (payer) payer.paid += e.amount_cents;
      const cat = categories.find((c) => c.id === e.category_id);
      const key = cat?.id ?? 'none';
      const row = cats.get(key) ?? {
        categoryId: cat?.id ?? null, name: cat?.name ?? 'Sem categoria', emoji: cat?.emoji ?? '🧾',
        cents: 0, ratio: 0, byMember: {},
      };
      row.cents += e.amount_cents;
      for (const s of e.shares) {
        row.byMember[s.member_id] = (row.byMember[s.member_id] ?? 0) + s.share_cents;
        const p = people.get(s.member_id);
        if (p) p.share += s.share_cents;
      }
      cats.set(key, row);
    } else if (e.type === 'income') {
      income += e.amount_cents;
      if (payer) payer.received += e.amount_cents;
      for (const s of e.shares) {
        const p = people.get(s.member_id);
        if (p) p.incomeShare += s.share_cents;
      }
    } else {
      if (payer) payer.sent += e.amount_cents;
      const to = e.transfer_to ? people.get(e.transfer_to) : undefined;
      if (to) to.got += e.amount_cents;
    }
  }

  // Mesma regra da view member_balances no banco.
  for (const p of people.values()) {
    p.balance = p.paid - p.share - p.received + p.incomeShare + p.sent - p.got;
  }

  const list = [...people.values()];
  const transfers = settleUp(list.map((p) => ({ memberId: p.memberId, cents: p.balance })));
  const categoriesOut = [...cats.values()]
    .map((c) => ({ ...c, ratio: spent ? c.cents / spent : 0 }))
    .sort((a, b) => b.cents - a.cents);

  return {
    spent,
    income,
    net: income - spent,
    pending: transfers.reduce((a, t) => a + t.cents, 0),
    transfers,
    people: list,
    categories: categoriesOut,
  };
}

/**
 * Dívidas diretas entre cada par (sem simplificar): em cada despesa, quem participou deve
 * a parte dele a quem pagou; numa entrada, quem recebeu deve a parte de cada um; um acerto
 * de A para B abate o que A devia a B. No fim, compensa os dois sentidos de cada par.
 */
export function pairwiseDebts(entries: Entry[]): { from: string; to: string; cents: number }[] {
  const owe = new Map<string, number>(); // "devedor>credor" → centavos
  const add = (from: string, to: string, cents: number) => {
    if (from === to || !cents) return;
    owe.set(`${from}>${to}`, (owe.get(`${from}>${to}`) ?? 0) + cents);
  };
  for (const e of entries) {
    if (e.type === 'expense') for (const sh of e.shares) add(sh.member_id, e.paid_by, sh.share_cents);
    else if (e.type === 'income') for (const sh of e.shares) add(e.paid_by, sh.member_id, sh.share_cents);
    else if (e.type === 'transfer' && e.transfer_to) add(e.transfer_to, e.paid_by, e.amount_cents);
  }
  const out: { from: string; to: string; cents: number }[] = [];
  const done = new Set<string>();
  for (const key of owe.keys()) {
    const [a, b] = key.split('>');
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (done.has(pair)) continue;
    done.add(pair);
    const net = (owe.get(`${a}>${b}`) ?? 0) - (owe.get(`${b}>${a}`) ?? 0);
    if (net > 0) out.push({ from: a, to: b, cents: net });
    else if (net < 0) out.push({ from: b, to: a, cents: -net });
  }
  return out.sort((x, y) => y.cents - x.cents);
}
