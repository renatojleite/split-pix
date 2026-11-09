import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { EmojiPicker } from '@/components/emoji-picker';
import { MonthNav } from '@/components/group/month-nav';
import { PercentEditor } from '@/components/percent-editor';
import { Button, Card, EmojiTile, ErrorText, Header, Input, Loading, Screen, SectionTitle } from '@/components/ui';
import {
  useCategoryUsage, useClearCategoryRule, useDeleteCategory, useGroup, useSetSplitRule, useUpdateCategory, type GroupDetail,
} from '@/lib/api';
import { monthLabel, monthStart, today } from '@/lib/dates';
import { effectiveRule } from '@/lib/split';
import type { Category } from '@/lib/types';
import { colors, space, type } from '@/theme';

export default function RegraScreen() {
  const { id, categoryId } = useLocalSearchParams<{ id: string; categoryId?: string }>();
  const group = useGroup(id);
  if (!group.data) return <Screen><Header /><Loading /></Screen>;
  return <RuleForm detail={group.data} categoryId={categoryId ?? null} />;
}

function RuleForm({ detail, categoryId }: { detail: GroupDetail; categoryId: string | null }) {
  const { members } = detail;
  const save = useSetSplitRule(detail.group.id);
  const clear = useClearCategoryRule(detail.group.id);
  const [month, setMonth] = useState(monthStart(today()));
  const [bps, setBps] = useState<number[]>(() => {
    const rule = effectiveRule(detail.rules, categoryId, today());
    return members.map((m) => rule?.shares.find((s) => s.member_id === m.id)?.basis_points ?? 0);
  });

  const category = detail.categories.find((c) => c.id === categoryId);
  const hasOwn = !!categoryId && detail.rules.some((r) => r.category_id === categoryId);
  const valid = bps.reduce((a, b) => a + b, 0) === 10000;

  async function submit() {
    await save.mutateAsync({
      categoryId,
      effectiveFrom: month,
      shares: members.map((m, i) => ({ memberId: m.id, bp: bps[i] })),
    });
    router.back();
  }

  async function useDefault() {
    await clear.mutateAsync(categoryId!);
    router.back();
  }

  return (
    <Screen footer={<>
      <Button title="Salvar divisão" onPress={submit} disabled={!valid} loading={save.isPending} />
      {hasOwn ? <Button title="Usar o padrão do grupo" variant="ghost" onPress={useDefault} loading={clear.isPending} /> : null}
    </>}>
      <Header title={category ? 'Categoria' : 'Padrão do grupo'} />
      {category ? <CategoryEditor groupId={detail.group.id} category={category} /> : null}
      {category ? <SectionTitle>Divisão desta categoria</SectionTitle> : null}
      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.muted }}>
        {category
          ? `Lançamentos de ${category.name} usam este % em vez do padrão do grupo. Dá para ajustar item a item no lançamento.`
          : 'Vale para todo lançamento cuja categoria não tem % próprio.'}
      </Text>
      <Card>
        <PercentEditor rows={members.map((m) => ({ key: m.id, name: m.display_name, color: m.color }))}
          value={bps} onChange={setBps} />
      </Card>
      <View style={{ gap: 3 }}>
        <Text style={type.label}>A partir de</Text>
        <MonthNav month={month} onMonth={setMonth} />
        <Text style={{ fontSize: 12, lineHeight: 15, color: colors.muted }}>
          Lançamentos a partir de {monthLabel(month).toLowerCase()} usam esta divisão. Os já feitos não mudam.
        </Text>
      </View>
      <ErrorText>{save.error?.message ?? clear.error?.message}</ErrorText>
      {category ? <DeleteCategory groupId={detail.group.id} category={category} /> : null}
    </Screen>
  );
}

/** Nome e emoji, com salvar próprio (não mexe na divisão). */
function CategoryEditor({ groupId, category }: { groupId: string; category: Category }) {
  const update = useUpdateCategory(groupId);
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [picking, setPicking] = useState(false);
  const changed = (name.trim() && name.trim() !== category.name) || emoji !== category.emoji;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <EmojiTile emoji={emoji} size={50} onPress={() => setPicking(true)} label="Emoji da categoria" />
        <Input value={name} onChangeText={setName} maxLength={30} placeholder="Nome da categoria" style={{ flex: 1 }} />
      </View>
      {changed ? (
        <Button title="Salvar nome e emoji" variant="secondary" loading={update.isPending}
          onPress={() => update.mutate({ id: category.id, name, emoji })} />
      ) : null}
      {update.isSuccess && !changed ? <Text style={{ fontSize: 12, color: colors.positive }}>Salvo ✓</Text> : null}
      <ErrorText>{update.error?.message}</ErrorText>
      <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={setEmoji} title="Emoji da categoria" />
    </View>
  );
}

function DeleteCategory({ groupId, category }: { groupId: string; category: Category }) {
  const remove = useDeleteCategory(groupId);
  const usage = useCategoryUsage(groupId, category.id);
  const count = usage.data ?? 0;

  function confirm() {
    const impact = count === 0
      ? 'Nenhum lançamento usa esta categoria.'
      : `${count} ${count === 1 ? 'lançamento fica' : 'lançamentos ficam'} como "Sem categoria". Valores e divisões já feitos não mudam.`;
    Alert.alert(`Excluir "${category.name}"?`, `${impact} A regra de % desta categoria também é removida. Não dá para desfazer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await remove.mutateAsync(category.id); router.back(); } },
    ]);
  }

  return (
    <View style={{ gap: space.sm, paddingTop: space.lg }}>
      <Button title="Excluir categoria" variant="danger" icon="trash" onPress={confirm} loading={remove.isPending}
        disabled={usage.isLoading} />
      <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
        {usage.isLoading ? ' ' : count === 0 ? 'Sem lançamentos nesta categoria.' : `Usada em ${count} ${count === 1 ? 'lançamento' : 'lançamentos'}.`}
      </Text>
      <ErrorText>{remove.error?.message}</ErrorText>
    </View>
  );
}
