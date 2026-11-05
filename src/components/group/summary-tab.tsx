import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useAllEntries, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatBRL } from '@/lib/money';
import { shownPeople, summarize } from '@/lib/summary';
import { colors, space } from '@/theme';
import { Avatar, Button, Card, Chip, EmojiTile, ErrorText, Loading, SectionTitle, SplitBar } from '../ui';
import { MonthNav } from './month-nav';

export function SummaryTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const [scope, setScope] = useState<'month' | 'all'>('all');
  const monthly = useEntries(detail.group.id, month);
  const all = useAllEntries(detail.group.id, scope === 'all');
  const source = scope === 'month' ? monthly : all;
  const { categories } = detail;
  const members = detail.allMembers;
  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m?.user_id === userId ? 'Você' : m?.display_name ?? '—';
  };

  if (source.isLoading || !source.data) {
    return (
      <View style={{ padding: space.xl }}>
        {source.error ? <ErrorText>{source.error.message}</ErrorText> : <Loading />}
      </View>
    );
  }

  const s = summarize(source.data, members, categories);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 38, gap: space.md, paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="Acumulado" selected={scope === 'all'} onPress={() => setScope('all')} />
        <Chip label="Por mês" selected={scope === 'month'} onPress={() => setScope('month')} />
      </View>
      {scope === 'month' ? <MonthNav month={month} onMonth={onMonth} /> : null}
      <Button title="Compartilhar relatório" icon="share" variant="secondary"
        onPress={() => router.push({ pathname: '/g/[id]/relatorio', params: { id: detail.group.id, ...(scope === 'month' ? { month } : {}) } })} />

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Stat label="Gasto total" value={formatBRL(s.spent)} />
        <Stat label="Entradas" value={formatBRL(s.income)} tone={s.income ? 'positive' : undefined} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Stat label="Saldo (entradas − gastos)" value={formatBRL(s.net, { sign: true })}
          tone={s.net > 0 ? 'positive' : s.net < 0 ? 'negative' : undefined} />
        <Stat label="Pendente entre vocês" value={formatBRL(s.pending)} tone={s.pending ? 'negative' : undefined} />
      </View>

      {s.transfers.length ? (
        <Card style={{ gap: 5 }}>
          {s.transfers.map((t, i) => (
            <Text key={i} style={{ fontSize: 12, color: colors.text }}>
              {name(t.from)} → {name(t.to)}: <Text style={{ fontWeight: '700' }}>{formatBRL(t.cents)}</Text>
            </Text>
          ))}
          <Text style={{ fontSize: 11, color: colors.muted }}>Acerte pela aba Saldos.</Text>
        </Card>
      ) : null}

      <SectionTitle>Por pessoa</SectionTitle>
      {shownPeople(s.people, members).map((p) => {
        const m = members.find((x) => x.id === p.memberId)!;
        return (
          <Card key={p.memberId} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.display_name} color={m.color} size={29} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{m.display_name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: p.balance > 0 ? colors.positive : p.balance < 0 ? colors.negative : colors.muted }}>
                {formatBRL(p.balance, { sign: true })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 3 }}>
              <Detail label="Pagou" value={p.paid} />
              <Detail label="Parte nos gastos" value={p.share} />
              {p.received ? <Detail label="Recebeu" value={p.received} /> : null}
              {p.sent || p.got ? <Detail label="Acertos" value={p.sent - p.got} signed /> : null}
            </View>
          </Card>
        );
      })}

      <SectionTitle>Por categoria</SectionTitle>
      {s.categories.length === 0 ? (
        <Text style={{ fontSize: 12, color: colors.muted }}>Nenhum gasto {scope === 'month' ? 'neste mês' : 'ainda'}.</Text>
      ) : (
        <Card style={{ padding: 0 }}>
          {s.categories.map((c, i) => (
            <View key={c.categoryId ?? 'none'} style={{ padding: space.lg, gap: 6,
              borderBottomWidth: i === s.categories.length - 1 ? 0 : 1, borderColor: colors.divider }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <EmojiTile emoji={c.emoji} size={26} />
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.text }}>{c.name}</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{Math.round(c.ratio * 100)}%</Text>
                <Text style={{ width: 83, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.text }}>{formatBRL(c.cents)}</Text>
              </View>
              {/* Barra do tamanho da categoria no total, colorida por quem arca com ela. */}
              <View style={{ paddingLeft: 34 }}>
                <View style={{ width: `${Math.max(4, Math.round(c.ratio * 100))}%` }}>
                  <SplitBar parts={members.map((m) => ({ color: m.color, bp: c.byMember[m.id] ?? 0 }))} height={6} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {members.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
            <Text style={{ fontSize: 11, color: colors.muted }}>parte de {m.display_name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <Card style={{ flex: 1, gap: 3, padding: space.md }}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.text }}
        adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
    </Card>
  );
}

function Detail({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  return (
    <Text style={{ fontSize: 11, color: colors.muted }}>
      {label} <Text style={{ color: colors.textSoft, fontWeight: '600' }}>{formatBRL(value, { sign: signed })}</Text>
    </Text>
  );
}
