import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-field';
import { EmojiPicker } from '@/components/emoji-picker';
import { Icon } from '@/components/icons';
import {
  Button, Card, Chip, EmojiTile, ErrorText, Field, Header, IconButton, Input, Loading, Screen, Segmented, SplitBar,
} from '@/components/ui';
import { useAddCategory, useDeleteEntry, useEntry, useGroup, useSaveEntry, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { dayMonth, seriesDates, today } from '@/lib/dates';
import { centsFromInput, formatBRL, formatPercent, inputFromCents } from '@/lib/money';
import { effectiveRule, previewSplit } from '@/lib/split';
import type { Category, Entry, EntryType, RepeatEvery, SplitMode } from '@/lib/types';
import { colors, defaultEmoji, radius, space, type } from '@/theme';

type Params = {
  id: string; entryId?: string; duplicateOf?: string;
  type?: EntryType; from?: string; to?: string; amount?: string;
  // Vindos do leitor de comprovante (o formulário só pré-preenche; a pessoa confere).
  title?: string; date?: string; fromReceipt?: string;
};

export default function ItemScreen() {
  const params = useLocalSearchParams<Params>();
  const group = useGroup(params.id);
  // Duplicar = abrir o formulário de novo lançamento já preenchido com outro.
  const sourceId = params.entryId ?? params.duplicateOf;
  const entry = useEntry(params.id, sourceId);
  if (!group.data || (sourceId && !entry.data)) return <Screen><Header /><Loading /></Screen>;
  return <ItemForm params={params} detail={group.data} entry={entry.data ?? null} />;
}

/** Edição/duplicação carregam o lançamento; novo usa padrões (ou o acerto sugerido pela aba Saldos). */
function initialState(detail: GroupDetail, entry: Entry | null, params: Params, meId: string | undefined) {
  const members = detail.members;
  const all = new Set(members.map((m) => m.id)); // só ativos entram por padrão
  if (entry) {
    const duplicating = !!params.duplicateOf;
    return {
      kind: entry.type, title: entry.title, amount: entry.amount_cents, paidBy: entry.paid_by,
      emoji: entry.emoji,
      transferTo: entry.transfer_to ?? '', date: duplicating ? today() : entry.occurred_on, categoryId: entry.category_id,
      mode: entry.split_mode,
      // Duplicando: só quem ainda está no grupo.
      participants: entry.shares.length
        ? new Set(entry.shares.map((s) => s.member_id).filter((id) => !duplicating || all.has(id)))
        : all,
      percent: Object.fromEntries(entry.shares.map((s) => [s.member_id, s.basis_points ?? 0])) as Record<string, number>,
      exact: Object.fromEntries(entry.shares.map((s) => [s.member_id, s.share_cents])) as Record<string, number>,
    };
  }
  const other = members.find((m) => m.id !== meId);
  return {
    kind: params.type ?? ('expense' as EntryType),
    title: params.title ?? (params.type === 'transfer' ? 'Acerto' : ''),
    amount: params.amount ? Number(params.amount) : 0,
    emoji: null as string | null,
    paidBy: params.from ?? meId ?? members[0]?.id ?? '',
    transferTo: params.to ?? other?.id ?? '',
    date: params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today(),
    categoryId: null as string | null,
    mode: 'default' as SplitMode,
    participants: all,
    percent: {} as Record<string, number>,
    exact: {} as Record<string, number>,
  };
}

function ItemForm({ params, detail, entry }: { params: Params; detail: GroupDetail; entry: Entry | null }) {
  const { id, entryId } = params;
  const userId = useUserId();
  const save = useSaveEntry(id);
  const remove = useDeleteEntry(id);
  // Ativos + quem saiu mas aparece neste lançamento (edição de histórico).
  const involved = new Set([entry?.paid_by, entry?.transfer_to, ...(entry?.shares ?? []).map((x) => x.member_id)]);
  const members = detail.allMembers.filter((m) => !m.left_at || involved.has(m.id));
  const me = members.find((m) => m.user_id === userId);
  const [init] = useState(() => initialState(detail, entry, params, me?.id));

  const [kind, setKind] = useState<EntryType>(init.kind);
  const [title, setTitle] = useState(init.title);
  const [amount, setAmount] = useState(init.amount);
  const [paidBy, setPaidBy] = useState(init.paidBy);
  const [transferTo, setTransferTo] = useState(init.transferTo);
  const [date, setDate] = useState(init.date);
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId);
  const [mode, setMode] = useState<SplitMode>(init.mode);
  const [participants, setParticipants] = useState<Set<string>>(init.participants);
  const [percent, setPercent] = useState<Record<string, number>>(init.percent);
  const [exact, setExact] = useState<Record<string, number>>(init.exact);
  const [emoji, setEmoji] = useState<string | null>(init.emoji);
  const [picking, setPicking] = useState(false);
  const [repeatEvery, setRepeatEvery] = useState<RepeatEvery | 'none'>('none');
  const [repeatCount, setRepeatCount] = useState(3);

  const isEditing = !!entryId;
  const category = detail.categories.find((c) => c.id === categoryId);
  const shownEmoji = emoji ?? (kind === 'expense' ? category?.emoji ?? defaultEmoji.expense : defaultEmoji[kind]);
  const repeating = !isEditing && repeatEvery !== 'none';
  const dates = repeating ? seriesDates(date, repeatCount, repeatEvery) : [date];

  const rule = effectiveRule(detail.rules, categoryId, date);
  const ownCategoryRule = !!categoryId && rule?.category_id === categoryId;
  const memberIds = members.map((m) => m.id);
  const preview = previewSplit({ mode, amount, payer: paidBy, memberIds, participants, rule, percent, exact });

  // Ao trocar para % ou valores, parte do que a divisão atual mostra.
  function changeMode(next: SplitMode) {
    if (next === 'percent') setPercent(Object.fromEntries(preview.shares.map((s) => [s.memberId, s.bp])));
    if (next === 'exact') setExact(Object.fromEntries(preview.shares.map((s) => [s.memberId, s.cents])));
    setMode(next);
  }

  function toggle(memberId: string) {
    const next = new Set(participants);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    setParticipants(next);
  }

  const isTransfer = kind === 'transfer';
  const errors = [
    !title.trim() && 'Dê um título',
    amount <= 0 && 'Informe o valor',
    isTransfer && transferTo === paidBy && 'Escolha pessoas diferentes',
    !isTransfer && preview.error,
  ].filter(Boolean) as string[];

  async function submit() {
    const allSelected = participants.size === members.length;
    await save.mutateAsync({
      id: entryId,
      type: kind,
      title,
      amountCents: amount,
      paidBy,
      transferTo: isTransfer ? transferTo : null,
      categoryId: isTransfer ? null : categoryId,
      occurredOn: date,
      splitMode: isTransfer ? 'default' : mode,
      // 'Igual' manda a lista sempre: o banco não sabe quem saiu do grupo nesse modo.
      participants: mode === 'equal' ? [...participants] : mode === 'default' ? (allSelected ? null : [...participants]) : null,
      custom: mode === 'percent' ? percent : mode === 'exact' ? exact : null,
      emoji,
      repeatCount: repeating ? repeatCount : 1,
      repeatEvery: repeating ? repeatEvery : 'month',
    });
    router.back();
  }

  function confirmDelete() {
    const del = async (scope: 'one' | 'following') => {
      await remove.mutateAsync({ entryId: entryId!, scope });
      router.back();
    };
    const buttons = entry?.recurrence_id
      ? [{ text: 'Só este', onPress: () => del('one') },
         { text: 'Este e os próximos', style: 'destructive' as const, onPress: () => del('following') }]
      : [{ text: 'Excluir', style: 'destructive' as const, onPress: () => del('one') }];
    Alert.alert('Excluir lançamento?', `"${title}" sai da lista e dos saldos de todos.`, [
      { text: 'Cancelar', style: 'cancel' }, ...buttons,
    ]);
  }

  function duplicate() {
    router.replace({ pathname: '/g/[id]/item', params: { id, duplicateOf: entryId! } });
  }

  const sourceText =
    mode === 'default'
      ? ownCategoryRule ? `regra da categoria ${detail.categories.find((c) => c.id === categoryId)?.name}` : 'padrão do grupo'
      : 'ajuste neste item';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={<>
        <ErrorText>{save.error?.message}</ErrorText>
        <Button title="Salvar" onPress={submit} disabled={errors.length > 0} loading={save.isPending} />
      </>}>
        <Header title={isEditing ? 'Editar' : params.duplicateOf ? 'Duplicar' : 'Novo lançamento'}
          right={isEditing ? (
            <View style={{ flexDirection: 'row' }}>
              <IconButton name="copy" label="Duplicar" onPress={duplicate} />
              <IconButton name="trash" label="Excluir" color={colors.negative} onPress={confirmDelete} />
            </View>
          ) : undefined} />
        {params.fromReceipt && !isEditing ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.input, padding: space.md }}>
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.primaryInk }}>
              ✨ Preenchido pela leitura inteligente. Confira valor, data e título, escolha a categoria e salve.
            </Text>
          </View>
        ) : null}
        {isEditing && entry?.recurrence_total ? (
          <Text style={{ fontSize: 11, color: colors.muted }}>
            🔁 Ocorrência {entry.recurrence_index} de {entry.recurrence_total}. Alterações valem só para esta.
          </Text>
        ) : null}

        <Segmented<EntryType> accent value={kind} onChange={setKind} options={[
          { value: 'expense', label: 'Despesa' },
          { value: 'income', label: 'Receita' },
          { value: 'transfer', label: 'Transferir' },
        ]} />

        <Field label="Título">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <EmojiTile emoji={shownEmoji} size={45} onPress={() => setPicking(true)} label="Emoji do lançamento" />
            <Input value={title} onChangeText={setTitle} maxLength={80} style={{ flex: 1 }}
              placeholder={isTransfer ? 'Ex.: Acerto outubro' : kind === 'income' ? 'Ex.: Reembolso' : 'Ex.: Mercado'} />
          </View>
        </Field>
        <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={setEmoji} title="Emoji do lançamento" />

        {!isTransfer ? (
          <CategoryPicker categories={detail.categories} value={categoryId} onChange={setCategoryId} groupId={id} />
        ) : null}

        <Field label="Valor">
          <Input big value={amount ? `R$ ${inputFromCents(amount)}` : ''} placeholder="R$ 0,00"
            onChangeText={(t) => setAmount(centsFromInput(t))} keyboardType="number-pad" />
        </Field>

        <Field label={kind === 'expense' ? 'Pago por' : kind === 'income' ? 'Recebido por' : 'De'}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {members.map((m) => (
              <Chip key={m.id} label={m.id === me?.id ? `${m.display_name} (eu)` : m.display_name}
                color={m.color} selected={paidBy === m.id} onPress={() => setPaidBy(m.id)} />
            ))}
          </View>
        </Field>

        {isTransfer ? (
          <Field label="Para" hint="Transferência é um acerto entre vocês: não é dividida, só move o saldo.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {members.filter((m) => m.id !== paidBy).map((m) => (
                <Chip key={m.id} label={m.display_name} color={m.color} selected={transferTo === m.id} onPress={() => setTransferTo(m.id)} />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label="Quando">
          <DateField value={date} onChange={setDate} />
        </Field>

        {!isEditing ? (
          <Field label="Repetir">
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Chip label="Não" selected={repeatEvery === 'none'} onPress={() => setRepeatEvery('none')} />
              <Chip label="Todo mês" selected={repeatEvery === 'month'} onPress={() => setRepeatEvery('month')} />
              <Chip label="Toda semana" selected={repeatEvery === 'week'} onPress={() => setRepeatEvery('week')} />
            </View>
            {repeating ? (
              <Card style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>Quantas vezes</Text>
                  <IconButton name="chevron-left" label="Menos vezes" onPress={() => setRepeatCount(Math.max(2, repeatCount - 1))} />
                  <Text style={{ width: 32, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.text }}>{repeatCount}×</Text>
                  <IconButton name="chevron-right" label="Mais vezes" onPress={() => setRepeatCount(Math.min(36, repeatCount + 1))} />
                </View>
                <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
                  {dates.length <= 6 ? dates.map(dayMonth).join(' · ') : `${dayMonth(dates[0])} até ${dayMonth(dates[dates.length - 1])}`}
                  {'\n'}Cria {repeatCount} lançamentos de {formatBRL(amount)} — {formatBRL(amount * repeatCount)} no total. Cada um usa a divisão vigente na sua data.
                </Text>
              </Card>
            ) : null}
          </Field>
        ) : null}

        {!isTransfer ? (
          <>
            <View style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={type.label}>Divisão</Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>{sourceText}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {([['default', 'Padrão'], ['equal', 'Igual'], ['percent', '%'], ['exact', 'R$']] as const).map(([v, l]) => (
                  <View key={v} style={{ flex: 1 }}>
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === v }} onPress={() => changeMode(v)}
                      style={{ height: 29, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: mode === v ? colors.inverse : colors.card }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: mode === v ? '#FFFFFF' : colors.textSoft }}>{l}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <SplitBar parts={members.map((m) => ({ color: m.color, bp: preview.shares.find((s) => s.memberId === m.id)?.bp ?? 0 }))} height={8} />
              <Card style={{ padding: 0 }}>
                {members.map((m, i) => {
                  const share = preview.shares.find((s) => s.memberId === m.id);
                  const checkable = mode === 'default' || mode === 'equal';
                  const on = participants.has(m.id);
                  return (
                    <View key={m.id} style={{ minHeight: 45, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: 8,
                      borderBottomWidth: i === members.length - 1 ? 0 : 1, borderColor: colors.divider }}>
                      {checkable ? (
                        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={m.display_name}
                          onPress={() => toggle(m.id)} hitSlop={10}
                          style={{ width: 19, height: 19, borderRadius: 5, borderWidth: 2, borderColor: on ? colors.primary : colors.muted,
                            backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {on ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                        </Pressable>
                      ) : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />}
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text }} numberOfLines={1}>
                        {m.id === me?.id ? `${m.display_name} (eu)` : m.display_name}
                      </Text>
                      {mode === 'percent' ? (
                        <InlineNumber value={formatPercent(percent[m.id] ?? 0)} suffix="%" label={`Percentual de ${m.display_name}`}
                          onChange={(t) => {
                            const n = parseFloat(t.replace(',', '.'));
                            setPercent({ ...percent, [m.id]: Number.isNaN(n) ? 0 : Math.min(10000, Math.round(n * 100)) });
                          }} />
                      ) : (
                        <Text style={{ fontSize: 11, color: colors.muted }}>{formatPercent(share?.bp ?? 0)}%</Text>
                      )}
                      {mode === 'exact' ? (
                        <InlineNumber value={inputFromCents(exact[m.id] ?? 0) || '0,00'} prefix="R$" label={`Valor de ${m.display_name}`}
                          onChange={(t) => setExact({ ...exact, [m.id]: centsFromInput(t) })} />
                      ) : (
                        <Text style={{ width: 83, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.text }}>
                          {formatBRL(share?.cents ?? 0)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </Card>
              {preview.error && amount > 0 ? <ErrorText>{preview.error}</ErrorText> : null}
            </View>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function InlineNumber({ value, onChange, prefix, suffix, label }: {
  value: string; onChange: (t: string) => void; prefix?: string; suffix?: string; label: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 6, height: 32 }}>
      {prefix ? <Text style={{ fontSize: 12, color: colors.muted, marginRight: 3 }}>{prefix}</Text> : null}
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" selectTextOnFocus
        style={{ minWidth: 35, padding: 0, fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'right' }} />
      {suffix ? <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{suffix}</Text> : null}
    </View>
  );
}

/** Categorias em chips (com emoji) + "Nova" que cria e já seleciona sem sair do formulário. */
function CategoryPicker({ categories, value, onChange, groupId }: {
  categories: Category[]; value: string | null; onChange: (id: string | null) => void; groupId: string;
}) {
  // null = fechado; string = modal de nova categoria aberto (já com esse nome, vindo da busca).
  const [creating, setCreating] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const shownFor = useRef<string | null>(null);

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.label}>Categoria</Text>
        {categories.length ? (
          <Pressable onPress={() => setShowAll(true)} hitSlop={10} accessibilityRole="button"
            accessibilityLabel={`Ver todas as ${categories.length} categorias`}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Ver todas ({categories.length})</Text>
          </Pressable>
        ) : null}
      </View>
      {/* Uma linha só, rolando para o lado; vai até a borda da tela. */}
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -space.xl }}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: 6 }}>
        <Chip label="＋ Nova" onPress={() => setCreating('')} />
        {categories.map((c) => (
          <View key={c.id} onLayout={(e) => {
            // Ao editar (ou criar), a categoria escolhida já aparece sem precisar rolar.
            if (value === c.id && shownFor.current !== c.id) {
              shownFor.current = c.id;
              scroller.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - space.xl), animated: false });
            }
          }}>
            <Chip label={`${c.emoji} ${c.name}`} selected={value === c.id}
              onPress={() => onChange(value === c.id ? null : c.id)} />
          </View>
        ))}
      </ScrollView>
      <AllCategories visible={showAll} onClose={() => setShowAll(false)} categories={categories} value={value}
        onPick={(id) => { shownFor.current = null; onChange(id); setShowAll(false); }}
        onNew={(name) => { setShowAll(false); setCreating(name); }} />
      {/* Montado só quando abre: cada vez começa limpo. */}
      {creating !== null ? (
        <NewCategory groupId={groupId} initialName={creating} onClose={() => setCreating(null)}
          onCreated={(id) => { shownFor.current = null; onChange(id); setCreating(null); }} />
      ) : null}
    </View>
  );
}

/** Folha para criar categoria: emoji + nome. Ao criar, já fica selecionada no item. */
function NewCategory({ groupId, initialName, onClose, onCreated }: {
  groupId: string; initialName: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const add = useAddCategory(groupId);
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState('🏷️');
  const [picking, setPicking] = useState(false);

  async function create() {
    if (!name.trim()) return;
    const { id } = await add.mutateAsync({ name: name.trim(), emoji });
    onCreated(id);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: space.sm, paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.lg, gap: space.md }}>
          <View style={{ alignSelf: 'center', width: 32, height: 3, borderRadius: 2, backgroundColor: colors.divider }} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Nova categoria</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <EmojiTile emoji={emoji} size={42} onPress={() => setPicking(true)} label="Emoji da categoria" />
            <Input value={name} onChangeText={setName} placeholder="Nome da categoria" autoFocus maxLength={30}
              style={{ flex: 1, height: 42 }} returnKeyType="done" onSubmitEditing={create} />
          </View>
          <Text style={{ fontSize: 11, color: colors.muted }}>Toque no emoji para trocar. A categoria vale para todo o grupo.</Text>
          <ErrorText>{add.error?.message}</ErrorText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button title="Cancelar" variant="secondary" style={{ flex: 1, height: 38 }} onPress={onClose} />
            <Button title="Criar" style={{ flex: 1, height: 38 }} disabled={!name.trim()} loading={add.isPending} onPress={create} />
          </View>
        </View>
      </KeyboardAvoidingView>
      <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={setEmoji} title="Emoji da categoria" />
    </Modal>
  );
}

/** Todas as categorias numa folha que sobe de baixo, com busca quando são muitas. */
function AllCategories({ visible, onClose, categories, value, onPick, onNew }: {
  visible: boolean; onClose: () => void; categories: Category[]; value: string | null;
  onPick: (id: string | null) => void; onNew: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const shown = query.trim() ? categories.filter((c) => plain(c.name).includes(plain(query.trim()))) : categories;
  const close = () => { setQuery(''); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={close} accessibilityLabel="Fechar" />
      <View style={{ maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingTop: space.sm, paddingBottom: insets.bottom + space.lg, gap: space.md }}>
        <View style={{ alignSelf: 'center', width: 32, height: 3, borderRadius: 2, backgroundColor: colors.divider }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>Categorias</Text>
          {value ? (
            <Pressable onPress={() => { setQuery(''); onPick(null); }} hitSlop={10}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>Sem categoria</Text>
            </Pressable>
          ) : null}
        </View>
        {categories.length > 8 ? (
          <Input value={query} onChangeText={setQuery} placeholder="Buscar categoria" autoCorrect={false}
            style={{ marginHorizontal: space.xl, height: 38 }} />
        ) : null}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.xl,
          flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {shown.map((c) => (
            <Chip key={c.id} label={`${c.emoji} ${c.name}`} selected={value === c.id}
              onPress={() => { setQuery(''); onPick(value === c.id ? null : c.id); }} />
          ))}
          {!shown.length ? <Text style={{ fontSize: 12, color: colors.muted }}>Nenhuma categoria com esse nome.</Text> : null}
        </ScrollView>
        <Pressable onPress={() => { setQuery(''); onNew(shown.length ? '' : query.trim()); }} hitSlop={8} style={{ paddingHorizontal: space.xl }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
            {!shown.length && query.trim() ? `＋ Criar "${query.trim()}"` : '＋ Nova categoria'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
