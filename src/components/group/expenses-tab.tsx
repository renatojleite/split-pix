import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native';

import { useComments, useDeleteEntry, useEntries, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayLabel } from '@/lib/dates';
import { formatBRL, formatPercent } from '@/lib/money';
import { PREF, usePref } from '@/lib/prefs';
import type { Entry } from '@/lib/types';
import { colors, defaultEmoji, space } from '@/theme';
import { CommentBadge, CommentBox, CommentsModal } from '../comments';
import { MoreButton, PopoverMenu, type Anchor, type MenuItem } from '../popover-menu';
import { Card, EmojiTile, ErrorText, Loading } from '../ui';
import { CalendarBlock } from './calendar-block';
import { MonthNav } from './month-nav';
import { MonthTotals, PeopleBlock } from './people-block';

export function ExpensesTab({ detail, month, onMonth }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
}) {
  const userId = useUserId();
  const entries = useEntries(detail.group.id, month);
  const me = detail.members.find((m) => m.user_id === userId);
  const name = (id: string | null) => detail.allMembers.find((m) => m.id === id)?.display_name ?? '—';
  const category = (id: string | null) => detail.categories.find((c) => c.id === id);

  const list = entries.data ?? [];
  const comments = useComments(detail.group.id).data;
  const commentsOf = (id: string) => comments?.get(id) ?? [];
  const [showComments, setShowComments] = usePref<boolean>(PREF.commentsOpen, false);
  const [commentFor, setCommentFor] = useState<Entry | null>(null);
  // Dia escolhido no calendário; vale só enquanto o mês mostrado é o mesmo.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay && pickedDay.startsWith(month.slice(0, 7)) ? pickedDay : null;
  const visible = day ? list.filter((e) => e.occurred_on === day) : list;

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

  // Menu rápido do item (⋮ ou toque longo), flutuando ao lado do botão.
  const [menu, setMenu] = useState<{ entry: Entry; anchor: Anchor } | null>(null);
  function menuItems(e: Entry): MenuItem[] {
    const del = (scope: 'one' | 'following') => remove.mutate({ entryId: e.id, scope });
    return [
      { emoji: '💬', label: 'Comentar', onPress: () => setCommentFor(e) },
      { emoji: '✏️', label: 'Editar', onPress: () => openItem({ entryId: e.id }) },
      { emoji: '📋', label: 'Duplicar', onPress: () => openItem({ duplicateOf: e.id }) },
      ...(e.recurrence_id
        ? [{ emoji: '🗑️', label: 'Excluir só este', destructive: true, confirm: 'Excluir só este?', onPress: () => del('one') },
           { emoji: '🗑️', label: 'Excluir este e próximos', destructive: true, confirm: 'Excluir este e os próximos?', onPress: () => del('following') }]
        : [{ emoji: '🗑️', label: 'Excluir', destructive: true, confirm: `Excluir "${e.title.slice(0, 18)}"?`, onPress: () => del('one') }]),
    ];
  }


  const withComments = visible.filter((e) => commentsOf(e.id).length > 0).length;

  return (
    <>
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={entries.isRefetching} onRefresh={() => { entries.refetch(); }} />}
      contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 106, gap: space.sm }}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingTop: space.sm }}>
          <MonthNav month={month} onMonth={onMonth} />
          <MonthTotals entries={list} members={detail.allMembers} categories={detail.categories} meId={me?.id} />
          <PeopleBlock entries={list} members={detail.allMembers} categories={detail.categories} meId={me?.id} />
          <CalendarBlock month={month} entries={list} selected={day} onSelect={setPickedDay} />
          {day ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 12, backgroundColor: colors.primarySoft }}>
              <Text style={{ flex: 1, fontSize: 12, color: colors.primaryInk }}>
                Mostrando só <Text style={{ fontWeight: '700' }}>{dayLabel(day)}</Text> · {visible.length} {visible.length === 1 ? 'lançamento' : 'lançamentos'}
              </Text>
              <Pressable onPress={() => setPickedDay(null)} hitSlop={10} accessibilityRole="button">
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Ver todos</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: space.sm }} />
          {withComments > 0 ? (
            <Pressable onPress={() => setShowComments(!showComments)} accessibilityRole="switch" accessibilityState={{ checked: showComments }}
              accessibilityLabel={showComments ? 'Fechar todos os comentários' : 'Expandir todos os comentários'}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                paddingHorizontal: space.md, paddingVertical: 5, borderRadius: 15, borderWidth: 1,
                borderColor: showComments ? colors.noteStrong : colors.noteBorder,
                backgroundColor: pressed || showComments ? colors.noteBorder : colors.note })}>
              <Text style={{ fontSize: 12 }}>💬</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.noteInk }}>Comentários ({withComments})</Text>
            </Pressable>
          ) : null}
          {entries.isLoading ? <Loading /> : null}
          <ErrorText>{entries.error?.message}</ErrorText>
        </View>
      }
      ListEmptyComponent={
        entries.isLoading ? undefined : (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13, paddingVertical: 35 }}>
            {day ? 'Nenhum lançamento neste dia.' : 'Nenhum lançamento neste mês.'}
          </Text>
        )
      }
      renderSectionHeader={({ section }) => (
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSoft, paddingTop: space.md }}>{section.title}</Text>
      )}
      renderItem={({ item: e }) => {
        const notes = commentsOf(e.id);
        return (
        <View style={{ gap: space.xs }}>
        <Card onPress={() => openItem({ entryId: e.id })}
          onLongPress={(ev) => setMenu({ entry: e, anchor: { x: ev.nativeEvent.pageX - 180, y: ev.nativeEvent.pageY, width: 180, height: 0 } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 }}>
          <EmojiTile emoji={emojiOf(e)} size={35} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{e.title}</Text>
              {notes.length ? <CommentBadge count={notes.length} onPress={() => setCommentFor(e)} /> : null}
            </View>
            <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
              {e.recurrence_total ? `🔁 ${e.recurrence_index}/${e.recurrence_total} · ` : ''}{subtitle(e)}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: e.type === 'expense' ? colors.text : colors.muted }}>
            {formatBRL(e.amount_cents)}
          </Text>
          <MoreButton label={`Ações de ${e.title}`} onOpen={(anchor) => setMenu({ entry: e, anchor })} />
        </Card>
        {showComments && notes.length ? <CommentBox comments={notes} members={detail.allMembers} onPress={() => setCommentFor(e)} /> : null}
        </View>
        );
      }}
    />
    <PopoverMenu anchor={menu?.anchor ?? null} items={menu ? menuItems(menu.entry) : []} onClose={() => setMenu(null)} />
    <CommentsModal visible={!!commentFor} onClose={() => setCommentFor(null)} groupId={detail.group.id}
      entryId={commentFor?.id ?? null} title={commentFor?.title ?? ''} comments={commentFor ? commentsOf(commentFor.id) : []}
      members={detail.allMembers} myMemberId={me?.id} />
    </>
  );
}
