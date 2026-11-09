import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useComments, useDeleteEntries, useDeleteEntry, useDuplicateEntries, useEntries, useSetEntriesCategory, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayLabel } from '@/lib/dates';
import { formatBRL, formatPercent } from '@/lib/money';
import { PREF, usePref } from '@/lib/prefs';
import type { Entry } from '@/lib/types';
import { colors, defaultEmoji, space } from '@/theme';
import { CommentBadge, CommentBox, CommentsModal } from '../comments';
import { MoreButton, PopoverMenu, type Anchor, type MenuItem } from '../popover-menu';
import { Card, EmojiTile, ErrorText, Loading } from '../ui';
import { CategorySheet, ConfirmSheet, DuplicateSheet, SelectionBar } from './bulk';
import { CalendarBlock } from './calendar-block';
import { MonthNav } from './month-nav';
import { MonthTotals, PeopleBlock } from './people-block';

export function ExpensesTab({ detail, month, onMonth, onSelecting, newSince }: {
  detail: GroupDetail; month: string; onMonth: (m: string) => void;
  /** Quando eu tinha visto o grupo antes desta visita: o que outros incluíram depois fica em destaque. */
  newSince?: string | null;
  /** Avisa a tela do grupo para esconder o botão Adicionar durante a seleção. */
  onSelecting?: (on: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
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
      { emoji: '📋', label: 'Duplicar', onPress: () => setDup({ ids: [e.id], single: e }) },
      { emoji: '☑️', label: 'Selecionar vários', onPress: () => startSelect(e.id) },
      ...(e.recurrence_id
        ? [{ emoji: '🗑️', label: 'Excluir só este', destructive: true, confirm: 'Excluir só este?', onPress: () => del('one') },
           { emoji: '🗑️', label: 'Excluir este e próximos', destructive: true, confirm: 'Excluir este e os próximos?', onPress: () => del('following') }]
        : [{ emoji: '🗑️', label: 'Excluir', destructive: true, confirm: `Excluir "${e.title.slice(0, 18)}"?`, onPress: () => del('one') }]),
    ];
  }

  // Seleção de vários: excluir, duplicar, mudar categoria.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [dup, setDup] = useState<{ ids: string[]; single?: Entry } | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const setCategory = useSetEntriesCategory(detail.group.id);
  const duplicate = useDuplicateEntries(detail.group.id);
  const removeMany = useDeleteEntries(detail.group.id);
  const ids = selected ? [...selected] : [];
  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 3200); };
  function startSelect(id: string) { setSelected(new Set([id])); onSelecting?.(true); }
  function endSelect() { setSelected(null); onSelecting?.(false); }
  function toggle(id: string) {
    const next = new Set(selected ?? []);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  const plural = (n: number) => `${n} ${n === 1 ? 'lançamento' : 'lançamentos'}`;

  async function pickDuplicateTarget(target: string) {
    const job = dup;
    setDup(null);
    if (!job) return;
    // Um só, no mesmo grupo: abre o formulário já preenchido para ajustar data/valor.
    if (job.single && target === detail.group.id) { openItem({ duplicateOf: job.single.id }); return; }
    try {
      const n = await duplicate.mutateAsync({ ids: job.ids, targetGroupId: target });
      const skipped = job.ids.length - n;
      flash(`📋 ${plural(n)} ${n === 1 ? 'duplicado' : 'duplicados'}${skipped ? ` · ${skipped} acerto(s) sem as mesmas pessoas no destino` : ''}`);
      if (selected) endSelect();
    } catch (e) { flash(e instanceof Error ? e.message : 'Não foi possível duplicar'); }
  }

  const withComments = visible.filter((e) => commentsOf(e.id).length > 0).length;
  const isNew = (e: Entry) => !!newSince && !!e.created_at && e.created_at > newSince && !!e.created_by && e.created_by !== userId;

  return (
    <>
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={entries.isRefetching} onRefresh={() => { entries.refetch(); }} />}
      contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: selected ? 170 : 106, gap: space.sm }}
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
          <View style={{ width: '30%', alignSelf: 'center', height: 1, backgroundColor: colors.divider, marginVertical: space.sm }} />
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
        <Card onPress={() => (selected ? toggle(e.id) : openItem({ entryId: e.id }))}
          onLongPress={(ev) => (selected ? toggle(e.id)
            : setMenu({ entry: e, anchor: { x: ev.nativeEvent.pageX - 180, y: ev.nativeEvent.pageY, width: 180, height: 0 } }))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12,
            ...(isNew(e) ? { backgroundColor: '#EFF6FF' } : {}),
            ...(selected?.has(e.id) ? { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary } : {}) }}>
          {selected ? (
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
              borderColor: selected.has(e.id) ? colors.primary : colors.muted, backgroundColor: selected.has(e.id) ? colors.primary : 'transparent' }}>
              {selected.has(e.id) ? <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>✓</Text> : null}
            </View>
          ) : null}
          <EmojiTile emoji={emojiOf(e)} size={35} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{e.title}</Text>
              {isNew(e) ? (
                <View style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: '#FFFFFF' }}>NOVO</Text>
                </View>
              ) : null}
              {notes.length ? <CommentBadge count={notes.length} onPress={() => setCommentFor(e)} /> : null}
            </View>
            <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
              {e.recurrence_total ? `🔁 ${e.recurrence_index}/${e.recurrence_total} · ` : ''}{subtitle(e)}
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: e.type === 'expense' ? colors.text : colors.positive }}>
            {formatBRL(e.amount_cents)}
          </Text>
          {!selected ? <MoreButton label={`Ações de ${e.title}`} onOpen={(anchor) => setMenu({ entry: e, anchor })} /> : null}
        </Card>
        {showComments && notes.length ? <CommentBox comments={notes} members={detail.allMembers} onPress={() => setCommentFor(e)} /> : null}
        </View>
        );
      }}
    />
    {selected ? (
      <SelectionBar count={ids.length} total={visible.length} bottom={insets.bottom + 12}
        onAll={() => setSelected(new Set(ids.length === visible.length ? [] : visible.map((e) => e.id)))}
        onCategory={() => setCatOpen(true)} onDuplicate={() => setDup({ ids })} onDelete={() => setDelOpen(true)} onCancel={endSelect} />
    ) : null}
    {notice ? (
      <View pointerEvents="none" style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: insets.bottom + (selected ? 150 : 84),
        padding: space.md, borderRadius: 14, backgroundColor: colors.inverse }}>
        <Text style={{ fontSize: 13, color: '#FFFFFF', textAlign: 'center' }}>{notice}</Text>
      </View>
    ) : null}
    <DuplicateSheet visible={!!dup} onClose={() => setDup(null)} groupId={detail.group.id} count={dup?.ids.length ?? 0}
      onPick={pickDuplicateTarget} />
    <CategorySheet visible={catOpen} onClose={() => setCatOpen(false)} categories={detail.categories} count={ids.length}
      onPick={async (categoryId) => {
        setCatOpen(false);
        try {
          const n = await setCategory.mutateAsync({ ids, categoryId });
          flash(`🏷️ Categoria trocada em ${plural(n)}`);
          endSelect();
        } catch (e) { flash(e instanceof Error ? e.message : 'Não foi possível trocar a categoria'); }
      }} />
    <ConfirmSheet visible={delOpen} onClose={() => setDelOpen(false)} title={`Excluir ${plural(ids.length)}?`}
      subtitle="Os saldos são recalculados. Em séries recorrentes, exclui só os selecionados." action="Excluir"
      onConfirm={async () => {
        setDelOpen(false);
        try {
          const n = await removeMany.mutateAsync(ids);
          flash(`🗑️ ${plural(n)} ${n === 1 ? 'excluído' : 'excluídos'}`);
          endSelect();
        } catch (e) { flash(e instanceof Error ? e.message : 'Não foi possível excluir'); }
      }} />
    <PopoverMenu anchor={menu?.anchor ?? null} items={menu ? menuItems(menu.entry) : []} onClose={() => setMenu(null)} />
    <CommentsModal visible={!!commentFor} onClose={() => setCommentFor(null)} groupId={detail.group.id}
      entryId={commentFor?.id ?? null} title={commentFor?.title ?? ''} comments={commentFor ? commentsOf(commentFor.id) : []}
      members={detail.allMembers} myMemberId={me?.id} />
    </>
  );
}
