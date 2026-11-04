import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { MonthNav } from '@/components/group/month-nav';
import { PercentEditor } from '@/components/percent-editor';
import { Button, Card, ErrorText, Header, Loading, Screen } from '@/components/ui';
import { useClearCategoryRule, useGroup, useSetSplitRule, type GroupDetail } from '@/lib/api';
import { monthLabel, monthStart, today } from '@/lib/dates';
import { effectiveRule } from '@/lib/split';
import { colors, type } from '@/theme';

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
      <Header title={category ? category.name : 'Padrão do grupo'} />
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted }}>
        {category
          ? `Lançamentos de ${category.name} usam este % em vez do padrão do grupo. Dá para ajustar item a item no lançamento.`
          : 'Vale para todo lançamento cuja categoria não tem % próprio.'}
      </Text>
      <Card>
        <PercentEditor rows={members.map((m) => ({ key: m.id, name: m.display_name, color: m.color }))}
          value={bps} onChange={setBps} />
      </Card>
      <View style={{ gap: 4 }}>
        <Text style={type.label}>A partir de</Text>
        <MonthNav month={month} onMonth={setMonth} />
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
          Lançamentos a partir de {monthLabel(month).toLowerCase()} usam esta divisão. Os já feitos não mudam.
        </Text>
      </View>
      <ErrorText>{save.error?.message ?? clear.error?.message}</ErrorText>
    </Screen>
  );
}
