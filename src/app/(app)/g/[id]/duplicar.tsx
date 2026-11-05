import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { EmojiPicker } from '@/components/emoji-picker';
import { Button, Card, EmojiTile, ErrorText, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useDuplicateGroup, useGroup, type GroupDetail } from '@/lib/api';
import { colors, space } from '@/theme';

export default function DuplicarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  if (!group.data) return <Screen><Header title="Duplicar grupo" /><Loading /></Screen>;
  return <DuplicateForm detail={group.data} />;
}

function DuplicateForm({ detail }: { detail: GroupDetail }) {
  const { group, members, categories } = detail;
  const duplicate = useDuplicateGroup(group.id);
  const [name, setName] = useState(`${group.name} (cópia)`);
  const [emoji, setEmoji] = useState(group.emoji);
  const [picking, setPicking] = useState(false);
  const [copyEntries, setCopyEntries] = useState(false);

  async function submit() {
    const newId = await duplicate.mutateAsync({ name, emoji, copyEntries });
    router.dismissTo({ pathname: '/g/[id]', params: { id: newId } });
  }

  return (
    <Screen footer={<Button title="Criar cópia" icon="copy" onPress={submit} disabled={!name.trim()} loading={duplicate.isPending} />}>
      <Header title="Duplicar grupo" />
      <Field label="Nome do novo grupo">
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <EmojiTile emoji={emoji} size={45} onPress={() => setPicking(true)} label="Emoji do grupo" />
          <Input value={name} onChangeText={setName} maxLength={60} autoFocus selectTextOnFocus style={{ flex: 1 }} />
        </View>
      </Field>
      <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={setEmoji} title="Emoji do grupo" />

      <Card style={{ gap: 5 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>Vai junto</Text>
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.muted }}>
          {members.length} pessoas ({members.map((m) => m.display_name).join(', ')}), {categories.length} categorias
          e a divisão em vigor hoje. Quem já tem conta vê o grupo novo na hora; o código de convite é novo.
        </Text>
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Copiar os lançamentos</Text>
          <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
            Desligado: começa vazio, como um mês novo. Ligado: leva todos os lançamentos com a divisão original.
          </Text>
        </View>
        <Switch value={copyEntries} onValueChange={setCopyEntries} accessibilityLabel="Copiar os lançamentos"
          trackColor={{ true: colors.primary, false: colors.divider }} thumbColor="#FFFFFF" />
      </Card>
      <ErrorText>{duplicate.error?.message}</ErrorText>
    </Screen>
  );
}
