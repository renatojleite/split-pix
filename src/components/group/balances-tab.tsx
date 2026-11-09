import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAllEntries, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayMonth } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { pairwiseDebts, shownPeople, summarize } from '@/lib/summary';
import { colors, radius, space } from '@/theme';
import { PopoverMenu, type Anchor, type MenuItem } from '../popover-menu';
import { Avatar, Card, Chip, EmojiTile, ErrorText, Loading, SectionTitle } from '../ui';
import { MonthNav } from './month-nav';

export function BalancesTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const [scope, setScope] = useState<'month' | 'all'>('all');
  const monthly = useEntries(detail.group.id, month);
  const all = useAllEntries(detail.group.id, scope === 'all');
  const source = scope === 'month' ? monthly : all;
  const members = detail.allMembers;
  const me = members.find((m) => m.user_id === userId);
  const name = (id: string | null) => (id === me?.id ? 'Você' : members.find((m) => m.id === id)?.display_name ?? '—');

  const entries = source.data ?? [];
  const s = summarize(entries, members, detail.categories);
  const settlements = entries.filter((e) => e.type === 'transfer');
  // Pendências: dívida direta entre cada par (mais intuitivo que a versão simplificada).
  const debts = pairwiseDebts(entries);
  const [pend, setPend] = useState<{ t: { from: string; to: string; cents: number }; anchor: Anchor } | null>(null);
  function pendItems(t: { from: string; to: string; cents: number }): MenuItem[] {
    const params = { from: t.from, to: t.to, amount: String(t.cents) };
    const pix = (mode: 'receive' | 'pay') => router.push({ pathname: '/g/[id]/pix', params: { id: detail.group.id, mode, ...params } });
    return [
      ...(t.to === me?.id ? [{ emoji: '💸', label: 'Receber via Pix', onPress: () => pix('receive') }] : []),
      ...(t.from === me?.id ? [{ emoji: '💸', label: 'Pagar via Pix', onPress: () => pix('pay') }] : []),
      { emoji: '🤝', label: 'Registrar acerto', onPress: () => openTransfer(params) },
    ];
  }
  const openTransfer = (params: Record<string, string>) =>
    router.push({ pathname: '/g/[id]/item', params: { id: detail.group.id, type: 'transfer', ...params } });

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 42, gap: space.md, paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Acumulado" selected={scope === 'all'} onPress={() => setScope('all')} />
        <Chip label="Por mês" selected={scope === 'month'} onPress={() => setScope('month')} />
      </View>
      {scope === 'month' ? <MonthNav month={month} onMonth={onMonth} /> : null}
      {source.isLoading ? <Loading /> : null}
      <ErrorText>{source.error?.message}</ErrorText>

      {/* Pendências: quem deve a quem (resumo, funciona com 2, 3, 4… pessoas). Toque numa linha para acertar. */}
      {!source.isLoading ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.divider,
          padding: space.lg, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>Pendências</Text>
            {debts.length ? <Text style={{ fontSize: 12, color: colors.muted }}>total {formatBRL(debts.reduce((a, t) => a + t.cents, 0))}</Text> : null}
          </View>
          {debts.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.positive, fontWeight: '600' }}>
              ✓ Ninguém deve nada {scope === 'month' ? 'neste mês' : 'no total'}
            </Text>
          ) : debts.map((t, i) => {
            const mine = t.to === me?.id ? 'in' : t.from === me?.id ? 'out' : null;
            return (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${name(t.from)} deve ${formatBRL(t.cents)} a ${name(t.to)}`}
                onPress={(ev) => setPend({ t, anchor: { x: ev.nativeEvent.pageX - 200, y: ev.nativeEvent.pageY, width: 200, height: 0 } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 9, paddingHorizontal: space.sm,
                  borderRadius: 10, backgroundColor: pressed ? colors.card : mine === 'in' ? colors.positiveSoft : mine === 'out' ? colors.negativeSoft : 'transparent' })}>
                <Text style={{ flex: 1, fontSize: 14, color: colors.text }} numberOfLines={1}>
                  <Text style={{ fontWeight: '700' }}>{name(t.from)}</Text>
                  <Text style={{ color: colors.muted }}>  →  </Text>
                  <Text style={{ fontWeight: '700' }}>{name(t.to)}</Text>
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: mine === 'in' ? colors.positive : mine === 'out' ? colors.negative : colors.text }}>
                  {formatBRL(t.cents)}
                </Text>
                <Text style={{ fontSize: 16, color: colors.muted }}>›</Text>
              </Pressable>
            );
          })}
          {debts.length ? <Text style={{ fontSize: 11, color: colors.muted }}>Toque numa pendência para pagar/receber via Pix ou registrar o acerto.</Text> : null}
        </View>
      ) : null}

      <SectionTitle>Por pessoa</SectionTitle>
      {shownPeople(s.people, members).map((p) => {
        const m = members.find((x) => x.id === p.memberId)!;
        // Total gasto (pagou + acertos enviados) − cota − total recebido (acertos recebidos + entradas) + sua parte nas entradas = saldo.
        const spentTotal = p.paid + p.sent;
        const receivedTotal = p.got + p.received;
        const gotFrom = members
          .map((o) => ({ o, cents: settlements.filter((e) => e.transfer_to === m.id && e.paid_by === o.id).reduce((a, e) => a + e.amount_cents, 0) }))
          .filter((x) => x.cents > 0);
        const tone = p.balance > 0 ? colors.positive : p.balance < 0 ? colors.negative : colors.muted;
        return (
          <Card key={m.id} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar name={m.display_name} color={m.color} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>
                {m.display_name}{m.id === me?.id ? <Text style={{ fontSize: 12, fontWeight: '400', color: colors.muted }}>  você</Text> : null}
              </Text>
            </View>
            <View style={{ gap: 3 }}>
              <Line sign="" label="Total gasto" value={spentTotal} strong />
              <Sub label="Pagou (despesas)" value={p.paid} />
              <Sub label="Acertos enviados (transferências)" value={p.sent} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 5, paddingHorizontal: space.sm,
                paddingVertical: 7, borderRadius: 10, backgroundColor: colors.primarySoft }}>
                <Text style={{ width: 14, fontSize: 14, fontWeight: '700', color: colors.primaryInk }}>−</Text>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.primaryInk }}>Cota por pessoa</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primaryInk }}>{formatBRL(p.share)}</Text>
              </View>

              <Line sign="−" label="Total recebido" value={receivedTotal} strong />
              {gotFrom.map((x) => <Sub key={x.o.id} label={`Recebido de ${name(x.o.id)}`} value={x.cents} />)}
              {p.received ? <Sub label="Receitas (entradas)" value={p.received} /> : null}
              {!receivedTotal ? <Sub label="Nada recebido" value={0} /> : null}
              {p.incomeShare ? <Line sign="+" label="Sua parte nas receitas" value={p.incomeShare} /> : null}

              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, paddingVertical: 9,
                borderRadius: 10, backgroundColor: p.balance > 0 ? colors.positiveSoft : p.balance < 0 ? colors.negativeSoft : colors.card }}>
                <Text style={{ width: 14, fontSize: 16, fontWeight: '800', color: tone }}>=</Text>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: tone }}>
                  Saldo{p.balance > 0 ? ' · a receber' : p.balance < 0 ? ' · a pagar' : ' · em dia'}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: tone }}>{formatBRL(p.balance, { sign: true })}</Text>
              </View>
            </View>
          </Card>
        );
      })}

      <SectionTitle>{`Acertos ${scope === 'month' ? 'do mês' : 'registrados'}`}</SectionTitle>
      {settlements.length === 0 ? (
        <Text style={{ fontSize: 12, color: colors.muted }}>Nenhum acerto {scope === 'month' ? 'neste mês' : 'ainda'}.</Text>
      ) : (
        <Card style={{ padding: 0 }}>
          {settlements.map((e, i) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: space.lg,
              borderBottomWidth: i === settlements.length - 1 ? 0 : 1, borderColor: colors.divider }}>
              <EmojiTile emoji={e.emoji ?? '🔁'} size={32} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                  {name(e.paid_by)} → {name(e.transfer_to)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{dayMonth(e.occurred_on)} · {e.title}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{formatBRL(e.amount_cents)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Text style={{ fontSize: 12, lineHeight: 15, color: colors.muted }}>
        Total gasto = pagou + acertos enviados. Total recebido = acertos recebidos + receitas. Saldo = total gasto − cota por pessoa − total recebido + sua parte nas receitas. Atualiza na hora quando alguém do grupo lança.
      </Text>
      <PopoverMenu anchor={pend?.anchor ?? null} items={pend ? pendItems(pend.t) : []} onClose={() => setPend(null)} />
    </ScrollView>
  );
}

function Line({ sign, label, value, strong }: { sign: string; label: string; value: number; strong?: boolean }) {
  const style = { fontSize: strong ? 14 : 13, fontWeight: strong ? ('700' as const) : ('400' as const), color: strong ? colors.text : colors.textSoft };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm }}>
      <Text style={[style, { width: 14, color: colors.muted }]}>{sign}</Text>
      <Text style={[style, { flex: 1 }]}>{label}</Text>
      <Text style={style}>{formatBRL(value)}</Text>
    </View>
  );
}

function Sub({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: space.sm + 20, paddingRight: space.sm }}>
      <Text style={{ flex: 1, fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>{formatBRL(value)}</Text>
    </View>
  );
}
