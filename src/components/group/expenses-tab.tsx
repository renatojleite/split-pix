import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';

import { useDeleteEntry, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayLabel } from '@/lib/dates';
import { formatBRL, formatPercent } from '@/lib/money';
import type { Entry } from '@/lib/types';
import { colors, defaultEmoji, space } from '@/theme';
import { Card, EmojiTile, ErrorText, Loading } from '../ui';
import { CalendarBlock } from './calendar-block';
import { MonthNav } from './month-nav';
import { PeopleBlock } from './people-block';

export function ExpensesTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const entries = useEntries(detail.group.id, month);
  const me = detail.members.find((m) => m.user_id === userId);
  const name = (id: string | null) => detail.allMembers.find((m) => m.id === id)?.display_name ?? '—';
  const category = (id: string | null) => detail.categories.find((c) => c.id === id);

  const list = entries.data ?? [];
  // Dia escolhido no calendário; vale só enquanto o mês mostrado é o mesmo.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay && pickedDay.startsWith(month.slice(0, 7)) ? pickedDay : null;
  const visible = day ? list.filter((e) => e.occurred_on === day) : list;
  const expenses = list.filter((e) => e.type === 'expense');
  const total = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const mine = expenses.reduce((a, e) => a + (e.shares.find((s) => s.member_id === me?.id)?.share_cents ?? 0), 0);

  const sections = Object.values(
    visible.reduce<Record<string, { title: string; data: Entry[] }>>((acc, e) => {
      (acc[e.occurred_on] ??= { title: dayLabel(e.occurred_on), data: [] }).data.push(e);
      return acc;
    }, {}),
  );

  function ruleLabel(e: Entry) {
    if (e.split_mode === 'equal') return 'igualmente';
    if (e.split_mode === 'exact') return 'valores exatos';
    const pct = detail.allMembers
      .map((m) => e.shares.find((s) => s.member_id === m.id)?.basis_points ?? 0)
      .filter((bp) => bp > 0)
      .map(formatPercent)
      .join('/');
    if (e.split_mode === 'percent') return `ajuste ${pct}`;
    return `${category(e.category_id)?.name ?? 'padrão'} ${pct}`;
  }

  function subtitle(e: Entry) {
    if (e.type === 'transfer') return `${name(e.paid_by)} → ${name(e.transfer_to)}`;
    if (e.type === 'income') return `Recebido por ${name(e.paid_by)} · ${ruleLabel(e)}`;
    return `Pago por ${name(e.paid_by)} · ${ruleLabel(e)}`;
  }

  function emojiOf(e: Entry) {
    if (e.emoji) return e.emoji;
    if (e.type !== 'expense') return defaultEmoji[e.type];
    return category(e.category_id)?.emoji ?? defaultEmoji.expense;
  }

  const remove = useDeleteEntry(detail.group.id);
  const openItem = (params: Record<string, string>) =>
    router.push({ pathname: '/g/[id]/item', params: { id: detail.group.id, ...params } });

  function actions(e: Entry) {
    const del = (scope: 'one' | 'following') => remove.mutate({ entryId: e.id, scope });
    const deleteButtons = e.recurrence_id
      ? [{ text: 'Excluir só este', onPress: () => del('one') },
         { text: 'Excluir este e os próximos', style: 'destructive' as const, onPress: () => del('following') }]
      : [{ text: 'Excluir', style: 'destructive' as const, onPress: () => del('one') }];
    Alert.alert(e.title, undefined, [
      { text: 'Duplicar', onPress: () => openItem({ duplicateOf: e.id }) },
      ...deleteButtons,
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={entries.isRefetching} onRefresh={() => { entries.refetch(); }} />}
      contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 120, gap: space.sm }}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingTop: space.sm }}>
          <MonthNav month={month} onMonth={onMonth} />
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Minha parte" value={formatBRL(mine)} />
            <Stat label="Total do mês" value={formatBRL(total)} />
          </View>
          <PeopleBlock entries={list} members={detail.allMembers} categories={detail.categories} meId={me?.id} />
          <CalendarBlock month={month} entries={list} selected={day} onSelect={setPickedDay} />
          {day ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 14, backgroundColor: colors.primarySoft }}>
              <Text style={{ flex: 1, fontSize: 14, color: colors.primaryInk }}>
                Mostrando só <Text style={{ fontWeight: '700' }}>{dayLabel(day)}</Text> · {visible.length} {visible.length === 1 ? 'lançamento' : 'lançamentos'}
              </Text>
              <Pressable onPress={() => setPickedDay(null)} hitSlop={10} accessibilityRole="button">
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>Ver todos</Text>
              </Pressable>
            </View>
          ) : null}
          {list.length > 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>Toque e segure um item para duplicar ou excluir</Text>
          ) : null}
          {entries.isLoading ? <Loading /> : null}
          <ErrorText>{entries.error?.message}</ErrorText>
        </View>
      }
      ListEmptyComponent={
        entries.isLoading ? undefined : (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 15, paddingVertical: 40 }}>
            {day ? 'Nenhum lançamento neste dia.' : 'Nenhum lançamento neste mês.'}
          </Text>
        )
      }
      renderSectionHeader={({ section }) => (
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSoft, paddingTop: space.md }}>{section.title}</Text>
      )}
      renderItem={({ item: e }) => (
        <Card onPress={() => openItem({ entryId: e.id })} onLongPress={() => actions(e)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <EmojiTile emoji={emojiOf(e)} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }} numberOfLines={1}>{e.title}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>
              {e.recurrence_total ? `🔁 ${e.recurrence_index}/${e.recurrence_total} · ` : ''}{subtitle(e)}
            </Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: e.type === 'expense' ? colors.text : colors.muted }}>
            {formatBRL(e.amount_cents)}
          </Text>
        </Card>
      )}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{value}</Text>
    </View>
  );
}
