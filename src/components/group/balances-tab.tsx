import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useBalances, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatBRL } from '@/lib/money';
import { settleUp } from '@/lib/split';
import { colors, space } from '@/theme';
import { Avatar, Button, Card, Chip, ErrorText, Loading, SectionTitle } from '../ui';
import { MonthNav } from './month-nav';

export function BalancesTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const balances = useBalances(detail.group.id);
  const entries = useEntries(detail.group.id, month);
  const { members } = detail;
  const me = members.find((m) => m.user_id === userId);

  const rows = members.map((m) => ({
    member: m,
    cents: (balances.data ?? [])
      .filter((b) => b.member_id === m.id && (scope === 'all' || b.month === month))
      .reduce((a, b) => a + b.balance_cents, 0),
  }));

  // Quanto cada um pagou e consumiu de despesas no mês (detalhe da linha).
  const paid = (id: string) =>
    (entries.data ?? []).filter((e) => e.type === 'expense' && e.paid_by === id).reduce((a, e) => a + e.amount_cents, 0);
  const consumed = (id: string) =>
    (entries.data ?? []).filter((e) => e.type === 'expense')
      .reduce((a, e) => a + (e.shares.find((s) => s.member_id === id)?.share_cents ?? 0), 0);

  const transfers = settleUp(rows.map((r) => ({ memberId: r.member.id, cents: r.cents })));
  const name = (id: string) => (id === me?.id ? 'Você' : members.find((m) => m.id === id)?.display_name ?? '—');

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 48, gap: space.md, paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Por mês" selected={scope === 'month'} onPress={() => setScope('month')} />
        <Chip label="Acumulado" selected={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      {scope === 'month' ? <MonthNav month={month} onMonth={onMonth} /> : null}
      {balances.isLoading ? <Loading /> : null}
      <ErrorText>{balances.error?.message}</ErrorText>

      {transfers.length === 0 && !balances.isLoading ? (
        <Card style={{ backgroundColor: colors.card, gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>Tudo certo</Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>Ninguém deve nada {scope === 'month' ? 'neste mês' : 'no total'}.</Text>
        </Card>
      ) : null}

      {transfers.map((t, i) => {
        const iReceive = t.to === me?.id;
        const iPay = t.from === me?.id;
        const tone = iReceive ? colors.positive : iPay ? colors.negative : colors.text;
        const headline = iReceive ? `${name(t.from)} te deve` : iPay ? `Você deve a ${name(t.to)}` : `${name(t.from)} deve a ${name(t.to)}`;
        return (
          <Card key={i} style={{ gap: 14, backgroundColor: iReceive ? colors.positiveSoft : iPay ? colors.negativeSoft : colors.card, borderRadius: 24, padding: 20 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 15, color: tone }}>{headline}</Text>
              <Text style={{ fontSize: 34, fontWeight: '700', color: tone }}>{formatBRL(t.cents)}</Text>
            </View>
            <Button title="Registrar acerto" variant={iReceive ? 'positive' : 'primary'}
              onPress={() => router.push({
                pathname: '/g/[id]/item',
                params: { id: detail.group.id, type: 'transfer', from: t.from, to: t.to, amount: String(t.cents) },
              })} />
          </Card>
        );
      })}

      <SectionTitle>Por pessoa</SectionTitle>
      {rows.map(({ member: m, cents }) => (
        <Card key={m.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={m.display_name} color={m.color} />
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
              {m.display_name}{m.id === me?.id ? <Text style={{ fontSize: 14, fontWeight: '400', color: colors.muted }}>  você</Text> : null}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: cents > 0 ? colors.positive : cents < 0 ? colors.negative : colors.muted }}>
              {formatBRL(cents, { sign: true })}
            </Text>
          </View>
          {scope === 'month' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Pagou {formatBRL(paid(m.id))}</Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>Parte {formatBRL(consumed(m.id))}</Text>
            </View>
          ) : null}
        </Card>
      ))}
      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
        Saldo = o que pagou − a sua parte (receitas e acertos entram também). Atualiza na hora quando alguém do grupo lança ou edita.
      </Text>
    </ScrollView>
  );
}
