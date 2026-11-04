/// <reference types="node" />
// npm test  (Node 22.18+ roda TypeScript direto)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMonths, monthStart } from '../src/lib/dates.ts';
import { centsFromInput, formatBRL, formatPercent } from '../src/lib/money.ts';
import { allocateCents, effectiveRule, previewSplit, settleUp } from '../src/lib/split.ts';
import type { Rule } from '../src/lib/types.ts';

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
