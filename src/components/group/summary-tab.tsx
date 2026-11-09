import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAllEntries, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayMonth } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { shownPeople, summarize } from '@/lib/summary';
import { colors, radius, space } from '@/theme';
import { Icon } from '../icons';
import { Card, Chip, EmojiTile, ErrorText, Loading, SectionTitle, SplitBar } from '../ui';
import { MonthNav } from './month-nav';

export function SummaryTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const [scope, setScope] = useState<'month' | 'all'>('all');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
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
  const expenses = source.data.filter((e) => e.type === 'expense');
  const pct = (r: number) => `${(r * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 42, gap: space.md, paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Chip label="Acumulado" selected={scope === 'all'} onPress={() => setScope('all')} />
        <Chip label="Por mês" selected={scope === 'month'} onPress={() => setScope('month')} />
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar relatório"
          onPress={() => router.push({ pathname: '/g/[id]/relatorio', params: { id: detail.group.id, ...(scope === 'month' ? { month } : {}) } })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, height: 34,
            borderRadius: 17, backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 })}>
          <Icon name="share" size={15} color="#FFFFFF" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Relatório</Text>
        </Pressable>
      </View>
      {scope === 'month' ? <MonthNav month={month} onMonth={onMonth} /> : null}

      {/* Entradas e saldo geral ficam ocultos por enquanto. */}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Stat label="Gasto total" value={formatBRL(s.spent)} />
        <Stat label="Pendente entre vocês" value={formatBRL(s.pending)} tone={s.pending ? 'negative' : undefined} />
      </View>

      {s.transfers.length ? (
        <Card style={{ gap: 6 }}>
          {s.transfers.map((t, i) => (
            <Text key={i} style={{ fontSize: 13, color: colors.text }}>
              {name(t.from)} → {name(t.to)}: <Text style={{ fontWeight: '700' }}>{formatBRL(t.cents)}</Text>
            </Text>
          ))}
          <Text style={{ fontSize: 12, color: colors.muted }}>Acerte pela aba Saldos.</Text>
        </Card>
      ) : null}

      <SectionTitle>Por pessoa</SectionTitle>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.divider,
        padding: space.lg, gap: space.lg }}>
        {shownPeople(s.people, members).map((p) => {
          const m = members.find((x) => x.id === p.memberId)!;
          const count = expenses.filter((e) => e.paid_by === p.memberId).length;
          const ratio = s.spent ? p.paid / s.spent : 0;
          return (
            <View key={p.memberId} style={{ gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>{m.display_name}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{formatBRL(p.paid)}</Text>
              </View>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.card, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(ratio * 1000) / 10}%`, height: 10, borderRadius: 5, backgroundColor: m.color }} />
              </View>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {pct(ratio)} do total · {count} {count === 1 ? 'despesa' : 'despesas'} · cota {formatBRL(p.share)}
              </Text>
            </View>
          );
        })}
      </View>

      <SectionTitle>Por categoria</SectionTitle>
      {s.categories.length === 0 ? (
        <Text style={{ fontSize: 13, color: colors.muted }}>Nenhum gasto {scope === 'month' ? 'neste mês' : 'ainda'}.</Text>
      ) : (
        <Card style={{ padding: 0 }}>
          {s.categories.map((c, i) => {
            const key = c.categoryId ?? 'none';
            const open = openCats.has(key);
            const items = expenses.filter((e) => (e.category_id ?? 'none') === key)
              .sort((x, y) => y.occurred_on.localeCompare(x.occurred_on) || y.amount_cents - x.amount_cents);
            return (
            <View key={key} style={{ borderBottomWidth: i === s.categories.length - 1 ? 0 : 1, borderColor: colors.divider }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
                onPress={() => { const n = new Set(openCats); if (open) n.delete(key); else n.add(key); setOpenCats(n); }}
                style={({ pressed }) => ({ padding: space.lg, gap: 7, backgroundColor: pressed ? colors.card : 'transparent' })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <EmojiTile emoji={c.emoji} size={29} />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>{c.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{Math.round(c.ratio * 100)}%</Text>
                  <Text style={{ width: 91, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.text }}>{formatBRL(c.cents)}</Text>
                  <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
                    <Icon name="chevron-right" size={14} color={colors.muted} />
                  </View>
                </View>
                {/* Barra do tamanho da categoria no total, colorida por quem arca com ela. */}
                <View style={{ paddingLeft: 37 }}>
                  <View style={{ width: `${Math.max(4, Math.round(c.ratio * 100))}%` }}>
                    <SplitBar parts={members.map((m) => ({ color: m.color, bp: c.byMember[m.id] ?? 0 }))} height={7} />
                  </View>
                </View>
              </Pressable>
              {open ? (
                <View style={{ marginLeft: 37 + space.lg, marginRight: space.lg, marginBottom: space.md, gap: 2 }}>
                  {items.map((e) => (
                    <Pressable key={e.id} onPress={() => router.push({ pathname: '/g/[id]/item', params: { id: detail.group.id, entryId: e.id } })}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6,
                        borderTopWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.6 : 1 })}>
                      <Text style={{ width: 40, fontSize: 11, color: colors.muted }}>{dayMonth(e.occurred_on)}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: colors.textSoft }} numberOfLines={1}>{e.emoji ? `${e.emoji} ` : ''}{e.title}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{formatBRL(e.amount_cents)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            );
          })}
        </Card>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {members.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 4, backgroundColor: m.color }} />
            <Text style={{ fontSize: 12, color: colors.muted }}>parte de {m.display_name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <Card style={{ flex: 1, gap: 3, padding: space.md }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.text }}
        adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
    </Card>
  );
}
