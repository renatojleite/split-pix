import { router } from 'expo-router';
import { RefreshControl, SectionList, Text, View } from 'react-native';

import { useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayLabel } from '@/lib/dates';
import { formatBRL, formatPercent } from '@/lib/money';
import type { Entry } from '@/lib/types';
import { colors, space } from '@/theme';
import { Card, ErrorText, IconTile, Loading } from '../ui';
import { MonthNav } from './month-nav';

export function ExpensesTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const entries = useEntries(detail.group.id, month);
  const me = detail.members.find((m) => m.user_id === userId);
  const name = (id: string | null) => detail.members.find((m) => m.id === id)?.display_name ?? '—';
  const category = (id: string | null) => detail.categories.find((c) => c.id === id);

  const list = entries.data ?? [];
  const expenses = list.filter((e) => e.type === 'expense');
  const total = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const mine = expenses.reduce((a, e) => a + (e.shares.find((s) => s.member_id === me?.id)?.share_cents ?? 0), 0);

  const sections = Object.values(
    list.reduce<Record<string, { title: string; data: Entry[] }>>((acc, e) => {
      (acc[e.occurred_on] ??= { title: dayLabel(e.occurred_on), data: [] }).data.push(e);
      return acc;
    }, {}),
  );

  function ruleLabel(e: Entry) {
    if (e.split_mode === 'equal') return 'igualmente';
    if (e.split_mode === 'exact') return 'valores exatos';
    const pct = detail.members
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

  function icon(e: Entry) {
    if (e.type === 'transfer') return 'transfer';
    if (e.type === 'income') return 'income';
    return category(e.category_id)?.icon ?? 'tag';
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
          {entries.isLoading ? <Loading /> : null}
          <ErrorText>{entries.error?.message}</ErrorText>
        </View>
      }
      ListEmptyComponent={
        entries.isLoading ? undefined : (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 15, paddingVertical: 40 }}>
            Nenhum lançamento neste mês.
          </Text>
        )
      }
      renderSectionHeader={({ section }) => (
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSoft, paddingTop: space.md }}>{section.title}</Text>
      )}
      renderItem={({ item: e }) => (
        <Card onPress={() => router.push({ pathname: '/g/[id]/item', params: { id: detail.group.id, entryId: e.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <IconTile icon={icon(e)} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }} numberOfLines={1}>{e.title}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>{subtitle(e)}</Text>
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
