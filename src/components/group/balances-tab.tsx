import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useAllEntries, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayMonth } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { shownPeople, summarize } from '@/lib/summary';
import { colors, space } from '@/theme';
import { Avatar, Button, Card, Chip, EmojiTile, ErrorText, Loading, SectionTitle } from '../ui';
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

      {!source.isLoading && s.transfers.length === 0 ? (
        <Card style={{ gap: 3 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Tudo certo</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Ninguém deve nada {scope === 'month' ? 'neste mês' : 'no total'}.</Text>
        </Card>
      ) : null}

      {s.transfers.map((t, i) => {
        const iReceive = t.to === me?.id;
        const iPay = t.from === me?.id;
        const tone = iReceive ? colors.positive : iPay ? colors.negative : colors.text;
        const headline = iReceive ? `${name(t.from)} te deve` : iPay ? `Você deve a ${name(t.to)}` : `${name(t.from)} deve a ${name(t.to)}`;
        const params = { from: t.from, to: t.to, amount: String(t.cents) };
        return (
          <Card key={i} style={{ gap: 11, backgroundColor: iReceive ? colors.positiveSoft : iPay ? colors.negativeSoft : colors.card, borderRadius: 21, padding: 18 }}>
            <View style={{ gap: 3 }}>
              <Text style={{ fontSize: 13, color: tone }}>{headline}</Text>
              <Text style={{ fontSize: 30, fontWeight: '700', color: tone }}>{formatBRL(t.cents)}</Text>
            </View>
            {iReceive ? (
              <>
                <Button title="Receber via Pix" variant="positive"
                  onPress={() => router.push({ pathname: '/g/[id]/pix', params: { id: detail.group.id, mode: 'receive', ...params } })} />
                <Button title="Registrar acerto manual" variant="ghost" onPress={() => openTransfer(params)} style={{ height: 38 }} />
              </>
            ) : iPay ? (
              <>
                <Button title="Pagar via Pix" variant="negative"
                  onPress={() => router.push({ pathname: '/g/[id]/pix', params: { id: detail.group.id, mode: 'pay', ...params } })} />
                <Button title="Registrar acerto manual" variant="ghost" onPress={() => openTransfer(params)} style={{ height: 38 }} />
              </>
            ) : (
              <Button title="Registrar acerto" onPress={() => openTransfer(params)} />
            )}
          </Card>
        );
      })}

      <SectionTitle>Por pessoa</SectionTitle>
      {shownPeople(s.people, members).map((p) => {
        const m = members.find((x) => x.id === p.memberId)!;
        // A conta do saldo, linha a linha: total gasto (pagou + acertos enviados) − cota = saldo.
        const spentTotal = p.paid + p.sent;
        const incomeNet = p.received - p.incomeShare; // ficou com a parte dos outros numa entrada
        const tone = p.balance > 0 ? colors.positive : p.balance < 0 ? colors.negative : colors.muted;
        return (
          <Card key={m.id} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar name={m.display_name} color={m.color} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.text }}>
                {m.display_name}{m.id === me?.id ? <Text style={{ fontSize: 12, fontWeight: '400', color: colors.muted }}>  você</Text> : null}
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Line sign="" label="Pagou" value={p.paid} />
              <Line sign="+" label="Acertos enviados" value={p.sent} />
              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 2 }} />
              <Line sign="=" label="Total gasto" value={spentTotal} strong />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2, paddingHorizontal: space.sm,
                paddingVertical: 7, borderRadius: 10, backgroundColor: colors.primarySoft }}>
                <Text style={{ width: 14, fontSize: 14, fontWeight: '700', color: colors.primaryInk }}>−</Text>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.primaryInk }}>Cota por pessoa</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primaryInk }}>{formatBRL(p.share)}</Text>
              </View>
              {p.got ? <Line sign="−" label="Acertos recebidos" value={p.got} /> : null}
              {incomeNet ? <Line sign={incomeNet > 0 ? '−' : '+'} label="Entradas (recebeu além da sua parte)" value={Math.abs(incomeNet)} /> : null}
              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 2 }} />
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
        Total gasto = o que a pessoa pagou + acertos que ela enviou. Saldo = total gasto − cota por pessoa − acertos recebidos (entradas entram também). Atualiza na hora quando alguém do grupo lança.
      </Text>
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
