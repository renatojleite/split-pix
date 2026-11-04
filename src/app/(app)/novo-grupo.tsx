import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icons';
import { PercentEditor, equalBps } from '@/components/percent-editor';
import { Button, Card, ErrorText, Field, Header, IconTile, Input, Loading, Screen } from '@/components/ui';
import { useCreateGroup, useProfile } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { colors, groupIcons, space } from '@/theme';

const COLORS = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#14B8A6', '#EC4899', '#64748B'];

export default function NovoGrupo() {
  const userId = useUserId();
  const profile = useProfile(userId);
  if (!profile.data) return <Screen><Header title="Novo grupo" /><Loading /></Screen>;
  return <NewGroupForm initialName={profile.data.name} />;
}

function NewGroupForm({ initialName }: { initialName: string }) {
  const create = useCreateGroup();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('home');
  const [myName, setMyName] = useState(initialName);
  const [others, setOthers] = useState<string[]>(['']);
  const [bps, setBps] = useState<number[]>([5000, 5000]);

  const people = [myName || 'Você', ...others.map((o, i) => o || `Pessoa ${i + 2}`)];

  function setOthersAndResplit(next: string[]) {
    setOthers(next);
    setBps(equalBps(next.length + 1));
  }

  const valid =
    name.trim() && myName.trim() && others.every((o) => o.trim()) && bps.reduce((a, b) => a + b, 0) === 10000;

  async function submit() {
    const id = await create.mutateAsync({ name, icon, myName, others, basisPoints: bps });
    router.replace({ pathname: '/g/[id]', params: { id } });
  }

  return (
    <Screen footer={<Button title="Criar grupo" onPress={submit} disabled={!valid} loading={create.isPending} />}>
      <Header title="Novo grupo" />

      <Field label="Nome do grupo">
        <Input value={name} onChangeText={setName} placeholder="Ex.: Casa" maxLength={60} autoFocus />
      </Field>

      <Field label="Ícone">
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {groupIcons.map((i) => (
            <Pressable key={i} onPress={() => setIcon(i)} accessibilityRole="button"
              accessibilityLabel={`Ícone ${i}`} accessibilityState={{ selected: icon === i }}
              style={{ borderRadius: 16, borderWidth: 2, borderColor: icon === i ? colors.primary : 'transparent', padding: 2 }}>
              <IconTile icon={i} size={48} />
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Participantes">
        <Card style={{ padding: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderBottomWidth: 1, borderColor: colors.divider }}>
            <Input value={myName} onChangeText={setMyName} placeholder="Seu nome"
              style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
            <Text style={{ fontSize: 14, color: colors.muted }}>você</Text>
          </View>
          {others.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, borderBottomWidth: 1, borderColor: colors.divider }}>
              <Input value={o} placeholder="Nome (ex.: Paula)"
                onChangeText={(t) => setOthers(others.map((x, j) => (j === i ? t : x)))}
                style={{ flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }} />
              {others.length > 1 ? (
                <Pressable accessibilityLabel="Remover participante" hitSlop={10}
                  onPress={() => setOthersAndResplit(others.filter((_, j) => j !== i))}>
                  <Icon name="close" size={20} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={() => setOthersAndResplit([...others, ''])} style={{ height: 52, justifyContent: 'center', paddingHorizontal: space.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>+ Adicionar participante</Text>
          </Pressable>
        </Card>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          Quem ainda não tem o app entra depois pelo código do grupo e escolhe o próprio nome.
        </Text>
      </Field>

      <Field label="Divisão padrão">
        <Card>
          <PercentEditor
            rows={people.map((p, i) => ({ key: String(i), name: p, color: COLORS[i % COLORS.length] }))}
            value={bps} onChange={setBps} />
        </Card>
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
          Vale para todo lançamento sem regra própria. Depois dá para definir % por categoria e ajustar item a item.
        </Text>
      </Field>

      <ErrorText>{create.error?.message}</ErrorText>
    </Screen>
  );
}
