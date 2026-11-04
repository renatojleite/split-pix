import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useAllEntries, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayMonth } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { summarize } from '@/lib/summary';
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
  const { members } = detail;
  const me = members.find((m) => m.user_id === userId);
  const name = (id: string | null) => (id === me?.id ? 'Você' : members.find((m) => m.id === id)?.display_name ?? '—');

  const entries = source.data ?? [];
  const s = summarize(entries, members, detail.categories);
  const settlements = entries.filter((e) => e.type === 'transfer');
  const openTransfer = (params: Record<string, string>) =>
    router.push({ pathname: '/g/[id]/item', params: { id: detail.group.id, type: 'transfer', ...params } });

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 48, gap: space.md, paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Acumulado" selected={scope === 'all'} onPress={() => setScope('all')} />
        <Chip label="Por mês" selected={scope === 'month'} onPress={() => setScope('month')} />
      </View>
      {scope === 'month' ? <MonthNav month={month} onMonth={onMonth} /> : null}
      {source.isLoading ? <Loading /> : null}
      <ErrorText>{source.error?.message}</ErrorText>

      {!source.isLoading && s.transfers.length === 0 ? (
        <Card style={{ gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>Tudo certo</Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>Ninguém deve nada {scope === 'month' ? 'neste mês' : 'no total'}.</Text>
        </Card>
      ) : null}

      {s.transfers.map((t, i) => {
        const iReceive = t.to === me?.id;
        const iPay = t.from === me?.id;
        const tone = iReceive ? colors.positive : iPay ? colors.negative : colors.text;
        const headline = iReceive ? `${name(t.from)} te deve` : iPay ? `Você deve a ${name(t.to)}` : `${name(t.from)} deve a ${name(t.to)}`;
        const params = { from: t.from, to: t.to, amount: String(t.cents) };
        return (
          <Card key={i} style={{ gap: 12, backgroundColor: iReceive ? colors.positiveSoft : iPay ? colors.negativeSoft : colors.card, borderRadius: 24, padding: 20 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 15, color: tone }}>{headline}</Text>
              <Text style={{ fontSize: 34, fontWeight: '700', color: tone }}>{formatBRL(t.cents)}</Text>
            </View>
            {iReceive ? (
              <>
                <Button title="Receber via Pix" variant="positive"
                  onPress={() => router.push({ pathname: '/g/[id]/pix', params: { id: detail.group.id, mode: 'receive', ...params } })} />
                <Button title="Registrar acerto manual" variant="ghost" onPress={() => openTransfer(params)} style={{ height: 44 }} />
              </>
            ) : iPay ? (
              <>
                <Button title="Pagar via Pix" variant="negative"
                  onPress={() => router.push({ pathname: '/g/[id]/pix', params: { id: detail.group.id, mode: 'pay', ...params } })} />
                <Button title="Registrar acerto manual" variant="ghost" onPress={() => openTransfer(params)} style={{ height: 44 }} />
              </>
            ) : (
              <Button title="Registrar acerto" onPress={() => openTransfer(params)} />
            )}
          </Card>
        );
      })}

      <SectionTitle>Por pessoa</SectionTitle>
      {s.people.map((p) => {
        const m = members.find((x) => x.id === p.memberId)!;
        return (
          <Card key={m.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={m.display_name} color={m.color} />
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
                {m.display_name}{m.id === me?.id ? <Text style={{ fontSize: 14, fontWeight: '400', color: colors.muted }}>  você</Text> : null}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: p.balance > 0 ? colors.positive : p.balance < 0 ? colors.negative : colors.muted }}>
                {formatBRL(p.balance, { sign: true })}
              </Text>
            </View>
            <View style={{ gap: 4 }}>
              <Row label="Pagou" value={formatBRL(p.paid)} />
              <Row label="Parte nos gastos" value={formatBRL(p.share)} />
              {p.received || p.incomeShare ? <Row label="Receitas (recebeu / parte)" value={`${formatBRL(p.received)} / ${formatBRL(p.incomeShare)}`} /> : null}
              <Row label="Acertos enviados" value={formatBRL(p.sent)} />
              <Row label="Acertos recebidos" value={formatBRL(p.got)} />
            </View>
          </Card>
        );
      })}

      <SectionTitle>{`Acertos ${scope === 'month' ? 'do mês' : 'registrados'}`}</SectionTitle>
      {settlements.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.muted }}>Nenhum acerto {scope === 'month' ? 'neste mês' : 'ainda'}.</Text>
      ) : (
        <Card style={{ padding: 0 }}>
          {settlements.map((e, i) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.lg,
              borderBottomWidth: i === settlements.length - 1 ? 0 : 1, borderColor: colors.divider }}>
              <EmojiTile emoji={e.emoji ?? '🔁'} size={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                  {name(e.paid_by)} → {name(e.transfer_to)}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>{dayMonth(e.occurred_on)} · {e.title}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{formatBRL(e.amount_cents)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
        Saldo = pagou − parte nos gastos + acertos enviados − acertos recebidos (receitas entram também). Atualiza na hora quando alguém do grupo lança.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSoft }}>{value}</Text>
    </View>
  );
}
