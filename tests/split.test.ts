/// <reference types="node" />
// npm test  (Node 22.18+ roda TypeScript direto)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activityLabel, addMonths, monthGrid, monthStart, seriesDates } from '../src/lib/dates.ts';
import { centsFromInput, formatBRL, formatPercent } from '../src/lib/money.ts';
import { allocateCents, effectiveRule, previewSplit, settleUp } from '../src/lib/split.ts';
import { shownPeople, summarize } from '../src/lib/summary.ts';
import type { Category, Entry, Member, Rule } from '../src/lib/types.ts';

const NO_PIX = { pix_key_type: null, pix_key: null, pix_name: null, pix_city: null };
const R = 'renato';
const P = 'paula';

test('formata reais', () => {
  assert.equal(formatBRL(352500), 'R$ 3.525,00');
  assert.equal(formatBRL(-52500), '−R$ 525,00');
  assert.equal(formatBRL(52500, { sign: true }), '+R$ 525,00');
  assert.equal(formatBRL(5), 'R$ 0,05');
  assert.equal(centsFromInput('R$ 1.234,5'), 12345);
  assert.equal(formatPercent(6000), '60');
  assert.equal(formatPercent(3333), '33,33');
});

test('aloca centavos somando o total e sobra para quem pagou', () => {
  const s = allocateCents(10001, [R, P], [6000, 4000], P);
  assert.deepEqual(s.map((x) => x.cents), [6000, 4001]);
  const t = allocateCents(100, [R, P, 'ana'], [1, 1, 1], 'ana');
  assert.equal(t.reduce((a, x) => a + x.cents, 0), 100);
  assert.equal(t[2].cents, 34);
});

const rules: Rule[] = [
  { id: 'd0', group_id: 'g', category_id: null, effective_from: '1900-01-01', shares: [{ member_id: R, basis_points: 6000 }, { member_id: P, basis_points: 4000 }] },
  { id: 'd1', group_id: 'g', category_id: null, effective_from: '2026-11-01', shares: [{ member_id: R, basis_points: 5000 }, { member_id: P, basis_points: 5000 }] },
  { id: 'f', group_id: 'g', category_id: 'filhos', effective_from: '2026-10-01', shares: [{ member_id: R, basis_points: 7000 }, { member_id: P, basis_points: 3000 }] },
];

test('regra vigente: categoria > padrão, por data', () => {
  assert.equal(effectiveRule(rules, null, '2026-10-15')?.id, 'd0');
  assert.equal(effectiveRule(rules, null, '2026-11-03')?.id, 'd1');
  assert.equal(effectiveRule(rules, 'filhos', '2026-10-28')?.id, 'f');
  assert.equal(effectiveRule(rules, 'filhos', '2026-09-30')?.id, 'd0');
  assert.equal(effectiveRule(rules, 'mercado', '2026-10-15')?.id, 'd0');
});

const base = { payer: R, memberIds: [R, P], participants: new Set([R, P]), percent: {}, exact: {} };

test('exemplo do PRD: Natação Ber 70/30', () => {
  const p = previewSplit({ ...base, mode: 'default', amount: 35000, rule: effectiveRule(rules, 'filhos', '2026-10-28') });
  assert.equal(p.error, null);
  assert.deepEqual(p.shares.map((s) => s.cents), [24500, 10500]);
});

test('modos igual, %, valores e participante desmarcado', () => {
  const eq = previewSplit({ ...base, mode: 'equal', amount: 20000, rule: null });
  assert.deepEqual(eq.shares.map((s) => s.cents), [10000, 10000]);

  const pct = previewSplit({ ...base, mode: 'percent', amount: 1000, rule: null, percent: { [R]: 2500, [P]: 7500 } });
  assert.deepEqual(pct.shares.map((s) => s.cents), [250, 750]);
  assert.ok(previewSplit({ ...base, mode: 'percent', amount: 1000, rule: null, percent: { [R]: 2500 } }).error);

  const ex = previewSplit({ ...base, mode: 'exact', amount: 1000, rule: null, exact: { [R]: 300, [P]: 600 } });
  assert.match(ex.error ?? '', /Falta distribuir/);

  const only = previewSplit({ ...base, mode: 'default', amount: 5000, rule: rules[0], participants: new Set([P]) });
  assert.deepEqual(only.shares.map((s) => s.cents), [0, 5000]);
});

test('acerto: quem deve paga quem tem a receber', () => {
  assert.deepEqual(settleUp([{ memberId: R, cents: 52500 }, { memberId: P, cents: -52500 }]), [{ from: P, to: R, cents: 52500 }]);
  const three = settleUp([{ memberId: 'a', cents: 300 }, { memberId: 'b', cents: -100 }, { memberId: 'c', cents: -200 }]);
  assert.equal(three.reduce((a, t) => a + t.cents, 0), 300);
  assert.deepEqual(settleUp([{ memberId: R, cents: 0 }]), []);
});

test('datas', () => {
  assert.equal(monthStart('2026-10-28'), '2026-10-01');
  assert.equal(addMonths('2026-12-01', 1), '2027-01-01');
  assert.equal(addMonths('2026-01-01', -1), '2025-12-01');
});

test('série recorrente: mesmo dia, ajustando fim de mês (igual ao banco)', () => {
  assert.deepEqual(seriesDates('2026-10-31', 3, 'month'), ['2026-10-31', '2026-11-30', '2026-12-31']);
  assert.deepEqual(seriesDates('2027-01-31', 2, 'month'), ['2027-01-31', '2027-02-28']);
  assert.deepEqual(seriesDates('2026-11-02', 4, 'week').at(-1), '2026-11-23');
});

test('resumo: totais, por pessoa e por categoria batem com o exemplo do PRD', () => {
  const m = (id: string, i: number): Member => ({ id, group_id: 'g', user_id: null, display_name: id, role: 'member', color: '#000', position: i, left_at: null, ...NO_PIX });
  const members = [m(R, 0), m(P, 1)];
  const cat = (id: string, name: string, emoji: string): Category => ({ id, group_id: 'g', name, emoji, sort: 0 });
  const categories = [cat('mor', 'Moradia', '🏠'), cat('mer', 'Mercado', '🛒'), cat('fil', 'Filhos', '🧒')];
  const e = (type: Entry['type'], amount: number, paid: string, category: string | null, shares: [string, number][], to: string | null = null): Entry => ({
    id: Math.random().toString(), group_id: 'g', type, title: 't', amount_cents: amount, paid_by: paid, transfer_to: to,
    category_id: category, emoji: null, occurred_on: '2026-10-01', split_mode: 'default', recurrence_id: null,
    recurrence_index: null, recurrence_total: null, updated_by: null, updated_at: '',
    shares: shares.map(([member_id, share_cents]) => ({ member_id, share_cents, basis_points: null })),
  });
  const entries = [
    e('expense', 200000, R, 'mor', [[R, 100000], [P, 100000]]),
    e('expense', 80000, P, 'mer', [[R, 48000], [P, 32000]]),
    e('expense', 35000, R, 'fil', [[R, 24500], [P, 10500]]),
    e('expense', 20000, P, null, [[R, 10000], [P, 10000]]),
    e('income', 10000, R, null, [[R, 5000], [P, 5000]]),
  ];
  const s = summarize(entries, members, categories);
  assert.equal(s.spent, 335000);
  assert.equal(s.income, 10000);
  assert.equal(s.net, -325000);
  const r = s.people.find((p) => p.memberId === R)!;
  // Gastos: +52500. Receita: Renato recebeu 100 e a parte da Paula (50) é dela → −5000.
  assert.equal(r.balance, 47500);
  assert.equal(s.pending, 47500);
  assert.deepEqual(s.transfers, [{ from: P, to: R, cents: 47500 }]);
  assert.equal(s.categories[0].name, 'Moradia');
  assert.equal(s.categories.find((c) => c.name === 'Sem categoria')?.cents, 20000);
  assert.ok(Math.abs(s.categories.reduce((a, c) => a + c.ratio, 0) - 1) < 1e-9);

  // A conta mostrada em Saldos fecha: (pagou + enviados) − cota − recebidos − (entradas − sua parte) = saldo.
  const withTransfer = summarize([...entries, e('transfer', 20000, P, null, [], R)], members, categories);
  for (const x of withTransfer.people) {
    assert.equal((x.paid + x.sent) - x.share - x.got - (x.received - x.incomeShare), x.balance);
  }

  const settled = summarize([...entries, e('transfer', 47500, P, null, [], R)], members, categories);
  assert.equal(settled.pending, 0);
  assert.equal(settled.spent, 335000);
});

test('Pix: CRC do exemplo do manual do BR Code (Banco Central)', async () => {
  const { crc16 } = await import('../src/lib/pix.ts');
  const body = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(crc16(body), '1D3D');
});

test('Pix: payload com valor, chave celular e nome sem acento', async () => {
  const { buildPixPayload, crc16, normalizePixKey } = await import('../src/lib/pix.ts');
  assert.equal(normalizePixKey('phone', '(11) 98765-4321'), '+5511987654321');
  assert.equal(normalizePixKey('cpf', '123.456.789-09'), '12345678909');
  assert.throws(() => normalizePixKey('cpf', '123'));
  const p = buildPixPayload({ keyType: 'phone', key: '11987654321', name: 'Renato Leite', amountCents: 52500, txid: 'SPLITPIX-PX7K2M' });
  assert.match(p, /^000201/);
  assert.ok(p.includes('0014br.gov.bcb.pix0114+5511987654321'));
  assert.ok(p.includes('5406525.00'));
  assert.ok(p.includes('5912RENATO LEITE'));
  assert.ok(p.includes('6006BRASIL'));
  assert.ok(p.includes('62180514SPLITPIXPX7K2M'));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
  const accented = buildPixPayload({ keyType: 'email', key: 'Paula@Email.com', name: 'Paula Conceição', city: 'São Paulo' });
  assert.ok(accented.includes('paula@email.com') && accented.includes('PAULA CONCEICAO') && accented.includes('SAO PAULO'));
  assert.ok(!accented.includes('5406'), 'sem valor quando não informado');
});

test('calendário: grade do mês começa no dia da semana certo', () => {
  const nov = monthGrid('2026-11-01'); // 1/nov/2026 é domingo
  assert.equal(nov[0][0], '2026-11-01');
  assert.equal(nov.flat().filter(Boolean).length, 30);
  const fev = monthGrid('2028-02-01'); // 2028 é bissexto; 1/fev é terça
  assert.deepEqual(fev[0].slice(0, 3), [null, null, '2028-02-01']);
  assert.equal(fev.flat().filter(Boolean).at(-1), '2028-02-29');
  assert.ok(nov.every((w) => w.length === 7));
});

test('quem saiu do grupo só aparece no resumo se teve movimento', () => {
  const mk = (id: string, left: string | null): Member => ({ id, group_id: 'g', user_id: null, display_name: id, role: 'member', color: '#000', position: 0, left_at: left, ...NO_PIX });
  const members = [mk(R, null), mk(P, null), mk('ana', '2026-11-04')];
  const quiet = summarize([], members, []);
  assert.deepEqual(shownPeople(quiet.people, members).map((p) => p.memberId), [R, P]);
  const e: Entry = { id: 'x', group_id: 'g', type: 'expense', title: 't', amount_cents: 300, paid_by: 'ana', transfer_to: null,
    category_id: null, emoji: null, occurred_on: '2026-10-01', split_mode: 'equal', recurrence_id: null, recurrence_index: null,
    recurrence_total: null, updated_by: null, updated_at: '', shares: [R, P, 'ana'].map((m) => ({ member_id: m, share_cents: 100, basis_points: null })) };
  assert.ok(shownPeople(summarize([e], members, []).people, members).some((p) => p.memberId === 'ana'));
});

test('relatório: cabeçalho, pendente com Pix, chaves e extrato sem valores por pessoa', async () => {
  const { buildReport, ruleLabel } = await import('../src/lib/report.ts');
  const renato: Member = { id: R, group_id: 'g', user_id: 'u1', display_name: 'Renato', role: 'owner', color: '#000', position: 0, left_at: null,
    pix_key_type: 'phone', pix_key: '+5511987654321', pix_name: 'Renato Leite', pix_city: null };
  const paula: Member = { id: P, group_id: 'g', user_id: null, display_name: 'Paula', role: 'member', color: '#111', position: 1, left_at: null, ...NO_PIX };
  const categories: Category[] = [{ id: 'mer', group_id: 'g', name: 'Mercado', emoji: '🛒', sort: 0 }];
  const e = (id: string, day: string, title: string, amount: number, paid: string, shares: [string, number][], type: Entry['type'] = 'expense', to: string | null = null): Entry => ({
    id, group_id: 'g', type, title, amount_cents: amount, paid_by: paid, transfer_to: to, category_id: type === 'expense' ? 'mer' : null,
    emoji: null, occurred_on: day, split_mode: 'default', recurrence_id: null, recurrence_index: null, recurrence_total: null,
    updated_by: null, updated_at: '', shares: shares.map(([member_id, share_cents]) => ({ member_id, share_cents, basis_points: null })),
  });
  const entries = [
    e('2', '2026-11-03', 'Feira', 10000, R, [[R, 6000], [P, 4000]]),
    e('1', '2026-10-28', 'Mercado do mês', 80000, R, [[R, 48000], [P, 32000]]),
    e('3', '2026-11-04', 'Acerto via Pix', 6000, P, [], 'transfer', R),
  ];
  const base = { group: { name: 'Casa', emoji: '🏠', invite_code: 'PX7K2M' }, members: [renato, paula], categories, entries,
    month: null, appUrl: 'https://exemplo/app.apk', generatedOn: '2026-11-04' };

  const sum = buildReport({ ...base, kind: 'summary' });
  const lines = sum.split('\n');
  assert.deepEqual(lines.slice(0, 4), ['💸 *split-pix*', '━━━━━━━━━━━━━━', '🏠 *Casa* — relatório resumido',
    '📅 Período: 28/10/2026 a 04/11/2026 (acumulado)']);
  assert.ok(sum.includes('• Gasto total: *R$ 900,00*'));
  const pr = lines.indexOf('*Renato*');
  assert.deepEqual(lines.slice(pr - 1, pr + 5), ['', '*Renato*', '• Total dividido (parte): R$ 540,00', '• Valor gasto (pagou): R$ 900,00',
    '• Acertos: recebeu R$ 60,00', '👉 *Saldo: +R$ 300,00 — a receber*'], 'por pessoa: ordem e espaço');
  const at = lines.indexOf('*Paula → Renato*');
  assert.ok(at > 0 && lines[at - 1] === '', 'linha em branco antes de cada pendência');
  assert.equal(lines[at + 1], '💰 Valor: *R$ 300,00*');
  assert.equal(lines[at + 2], '📋 Pix copia e cola:');
  assert.equal(lines[at + 3], '');
  assert.match(lines[at + 4], /^000201[^`*_~]*5406300\.00[^`*_~]*$/, 'código sozinho numa linha, sem formatação');
  assert.ok(sum.includes('🛒 Mercado — R$ 900,00 (100%)'));
  assert.ok(sum.includes('• *Paula*: (ausente)') && sum.includes('   +5511987654321'));
  assert.ok(!sum.includes('Extrato'));
  assert.ok(sum.includes('📲 Baixe o app: https://exemplo/app.apk') && sum.includes('*PX7K2M*'));

  const st = buildReport({ ...base, kind: 'statement' });
  assert.ok(st.includes('🏠 *Casa* — extrato completo'));
  assert.ok(st.includes('🧾 *Extrato — 3 lançamentos*'));
  const i = st.indexOf('28/10 🛒 Mercado do mês — R$ 800,00');
  assert.ok(i > 0 && i < st.indexOf('03/11 🛒 Feira'), 'mais antigo primeiro');
  assert.ok(st.includes('   Pago por Renato · 60/40'));
  assert.ok(st.includes('   Paula → Renato (acerto)'));
  assert.ok(st.includes('_Outubro 2026_') && st.includes('_Novembro 2026_'));

  const month = buildReport({ ...base, kind: 'summary', month: '2026-11-01', entries: entries.slice(0, 1) });
  assert.ok(month.includes('📅 Período: 01/11/2026 a 30/11/2026 (Novembro 2026)'));
  assert.equal(ruleLabel({ ...entries[0], shares: [{ member_id: P, share_cents: 10000, basis_points: null }] }, [renato, paula]), 'só Paula');

  const settled = buildReport({ ...base, kind: 'summary', entries: [entries[1], e('4', '2026-11-04', 'Acerto', 32000, P, [], 'transfer', R)] });
  assert.ok(settled.includes('✅ Ninguém deve nada no período.'));

  // Credor sem chave: Pendente mostra só a dívida, sem aviso de cadastro
  const noKey = buildReport({ ...base, kind: 'summary', members: [{ ...renato, ...NO_PIX }, paula] });
  assert.ok(noKey.includes('💰 Valor: *R$ 300,00*') && !noKey.includes('Pix copia e cola'));
  assert.ok(noKey.includes('• *Renato*: (ausente)'));
});

test('data da última atividade: hoje, ontem ou data completa', () => {
  const now = new Date(2026, 10, 9, 18, 0);
  assert.equal(activityLabel(new Date(2026, 10, 9, 17, 35).toISOString(), now), 'hoje - 17h35');
  assert.equal(activityLabel(new Date(2026, 10, 8, 9, 5).toISOString(), now), 'ontem - 9h05');
  assert.equal(activityLabel(new Date(2026, 9, 20, 17, 35).toISOString(), now), '20/10/2026 - 17h35');
});
