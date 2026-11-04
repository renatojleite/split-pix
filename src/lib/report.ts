// Relatório em texto para compartilhar no WhatsApp (negrito com *asteriscos*).
// Puro: recebe tudo pronto, para dar para testar sem app nem banco.

import { addDays, addMonths, monthLabel } from './dates.ts';
import { formatBRL, formatPercent } from './money.ts';
import { buildPixPayload, type PixKeyType } from './pix.ts';
import { shownPeople, summarize } from './summary.ts';
import type { Category, Entry, Group, Member } from './types';

export type ReportKind = 'summary' | 'statement';

export type ReportInput = {
  kind: ReportKind;
  group: Pick<Group, 'name' | 'emoji' | 'invite_code'>;
  members: Member[]; // todos, inclusive quem saiu (histórico)
  categories: Category[];
  entries: Entry[];
  /** Mês 'YYYY-MM-01' do filtro, ou null para o acumulado. */
  month: string | null;
  appUrl: string;
  generatedOn: string; // 'YYYY-MM-DD'
};

const LINE = '━━━━━━━━━━━━━━';

const KEY_LABEL: Record<PixKeyType, string> = { cpf: 'CPF/CNPJ', phone: 'Celular', email: 'E-mail', random: 'Aleatória' };

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' */
export function brDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Período coberto: o mês inteiro do filtro, ou do primeiro ao último lançamento. */
export function reportPeriod(entries: Entry[], month: string | null): { from: string; to: string; label: string } | null {
  if (month) return { from: month, to: addDays(addMonths(month, 1), -1), label: monthLabel(month) };
  if (!entries.length) return null;
  const dates = entries.map((e) => e.occurred_on).sort();
  return { from: dates[0], to: dates[dates.length - 1], label: 'acumulado' };
}

/** Como o lançamento foi dividido, em poucas palavras: "60/40", "igual", "só Paula". */
export function ruleLabel(e: Entry, members: Member[]): string {
  if (e.type === 'transfer') return '';
  const shares = e.shares.filter((s) => s.share_cents > 0);
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? '—';
  if (shares.length === 1) return `só ${name(shares[0].member_id)}`;
  if (e.split_mode === 'equal') return 'igual';
  if (!e.amount_cents || !shares.length) return '';
  const order = (id: string) => members.findIndex((m) => m.id === id);
  return [...shares]
    .sort((a, b) => order(a.member_id) - order(b.member_id))
    .map((s) => formatPercent(s.basis_points ?? Math.round((s.share_cents * 10000) / e.amount_cents)))
    .join('/');
}

function pixFor(m: Member, cents: number, group: ReportInput['group']): string | null {
  if (!m.pix_key_type || !m.pix_key) return null;
  try {
    return buildPixPayload({
      keyType: m.pix_key_type, key: m.pix_key, name: m.pix_name ?? m.display_name, city: m.pix_city ?? undefined,
      amountCents: cents, description: `split-pix ${group.name}`, txid: `SPLITPIX${group.invite_code}`,
    });
  } catch {
    return null; // chave salva em formato que o BR Code não aceita: trata como ausente
  }
}

export function buildReport(input: ReportInput): string {
  const { kind, group, members, categories, entries, month, appUrl, generatedOn } = input;
  const s = summarize(entries, members, categories);
  const period = reportPeriod(entries, month);
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? '—';
  const out: string[] = [];
  const add = (...lines: string[]) => out.push(...lines);

  add(
    '💸 *split-pix*',
    LINE,
    `${group.emoji} *${group.name}* — ${kind === 'summary' ? 'relatório resumido' : 'extrato completo'}`,
    period
      ? `📅 Período: ${brDate(period.from)} a ${brDate(period.to)} (${period.label})`
      : '📅 Período: sem lançamentos ainda',
  );

  // Números
  const expenses = entries.filter((e) => e.type === 'expense');
  const incomes = entries.filter((e) => e.type === 'income');
  const transfers = entries.filter((e) => e.type === 'transfer');
  const biggest = [...expenses].sort((a, b) => b.amount_cents - a.amount_cents)[0];
  const counts = [
    expenses.length ? `${expenses.length} ${expenses.length === 1 ? 'despesa' : 'despesas'}` : '',
    incomes.length ? `${incomes.length} ${incomes.length === 1 ? 'entrada' : 'entradas'}` : '',
    transfers.length ? `${transfers.length} ${transfers.length === 1 ? 'acerto' : 'acertos'}` : '',
  ].filter(Boolean).join(', ');
  add('', '📊 *Números do período*', `• Gasto total: *${formatBRL(s.spent)}*`);
  if (s.income) add(`• Entradas: ${formatBRL(s.income)}`);
  add(`• Lançamentos: ${entries.length}${counts ? ` (${counts})` : ''}`);
  if (biggest) add(`• Maior gasto: ${formatBRL(biggest.amount_cents)} — ${biggest.title}`);
  if (expenses.length > 1) add(`• Média por despesa: ${formatBRL(Math.round(s.spent / expenses.length))}`);

  // Por pessoa
  add('', '👥 *Por pessoa*');
  for (const p of shownPeople(s.people, members)) {
    const status = p.balance > 0 ? ' (a receber)' : p.balance < 0 ? ' (a pagar)' : '';
    add(`*${name(p.memberId)}* — saldo ${formatBRL(p.balance, { sign: true })}${status}`);
    add(`   Pagou ${formatBRL(p.paid)} · Parte ${formatBRL(p.share)}`);
    if (p.received) add(`   Recebeu ${formatBRL(p.received)} em entradas`);
    if (p.sent || p.got) {
      add(`   Acertos: ${[p.sent ? `enviou ${formatBRL(p.sent)}` : '', p.got ? `recebeu ${formatBRL(p.got)}` : ''].filter(Boolean).join(' · ')}`);
    }
  }

  // Por categoria (sem valores por pessoa)
  add('', '🏷️ *Por categoria*');
  if (!s.categories.length) add('Nenhum gasto no período.');
  for (const c of s.categories) add(`${c.emoji} ${c.name} — ${formatBRL(c.cents)} (${Math.round(c.ratio * 100)}%)`);

  // Pendente, com o Pix já no valor
  add('', '⏳ *Pendente*');
  if (!s.transfers.length) add('✅ Ninguém deve nada no período.');
  for (const t of s.transfers) {
    add(`• ${name(t.from)} deve *${formatBRL(t.cents)}* a ${name(t.to)}`);
    const to = members.find((m) => m.id === t.to);
    const code = to ? pixFor(to, t.cents, group) : null;
    // Sem chave, só a dívida: o "(ausente)" já aparece em Chaves Pix.
    if (code) add(`   Pix copia e cola (${formatBRL(t.cents)} para ${name(t.to)}):`, code);
  }

  // Chaves Pix de quem está no grupo
  add('', '💳 *Chaves Pix*');
  for (const m of members.filter((x) => !x.left_at)) {
    if (m.pix_key_type && m.pix_key) add(`• *${m.display_name}* (${KEY_LABEL[m.pix_key_type]})`, `   ${m.pix_key}`);
    else add(`• *${m.display_name}*: (ausente)`);
  }

  // Extrato: tudo, do mais antigo ao mais novo, sem valores por pessoa
  if (kind === 'statement') {
    const list = [...entries].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.updated_at.localeCompare(b.updated_at));
    add('', `🧾 *Extrato — ${list.length} ${list.length === 1 ? 'lançamento' : 'lançamentos'}*`);
    if (!list.length) add('Nenhum lançamento no período.');
    let lastMonth = '';
    const manyMonths = new Set(list.map((e) => e.occurred_on.slice(0, 7))).size > 1;
    for (const e of list) {
      const ym = e.occurred_on.slice(0, 7);
      if (manyMonths && ym !== lastMonth) {
        add(`_${monthLabel(`${ym}-01`)}_`);
        lastMonth = ym;
      }
      const cat = categories.find((c) => c.id === e.category_id);
      const emoji = e.emoji ?? (e.type === 'transfer' ? '💸' : e.type === 'income' ? '💰' : cat?.emoji ?? '🧾');
      const sign = e.type === 'income' ? '+' : '';
      add(`${brDate(e.occurred_on).slice(0, 5)} ${emoji} ${e.title} — ${sign}${formatBRL(e.amount_cents)}`);
      if (e.type === 'transfer') {
        add(`   ${name(e.paid_by)} → ${e.transfer_to ? name(e.transfer_to) : '—'} (acerto)`);
      } else {
        const rule = ruleLabel(e, members);
        add(`   ${e.type === 'income' ? 'Recebido por' : 'Pago por'} ${name(e.paid_by)}${rule ? ` · ${rule}` : ''}`);
      }
    }
  }

  add(
    '',
    LINE,
    `📲 Baixe o app: ${appUrl}`,
    `🔑 Código do grupo: *${group.invite_code}*`,
    `_Gerado em ${brDate(generatedOn)}_`,
  );
  return out.join('\n');
}
