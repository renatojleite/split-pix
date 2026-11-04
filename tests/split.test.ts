/// <reference types="node" />
// npm test  (Node 22.18+ roda TypeScript direto)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMonths, monthStart, seriesDates } from '../src/lib/dates.ts';
import { centsFromInput, formatBRL, formatPercent } from '../src/lib/money.ts';
import { allocateCents, effectiveRule, previewSplit, settleUp } from '../src/lib/split.ts';
import { summarize } from '../src/lib/summary.ts';
import type { Category, Entry, Member, Rule } from '../src/lib/types.ts';

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
  const m = (id: string, i: number): Member => ({ id, group_id: 'g', user_id: null, display_name: id, role: 'member', color: '#000', position: i });
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
