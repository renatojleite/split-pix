import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { EmojiPicker } from '@/components/emoji-picker';
import { Button, EmojiTile, ErrorText, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useDeleteGroup, useGroup, useUpdateGroup, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { colors, space } from '@/theme';

export default function EditarGrupoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  if (!group.data) return <Screen><Header title="Editar grupo" /><Loading /></Screen>;
  return <GroupForm detail={group.data} />;
}

function GroupForm({ detail }: { detail: GroupDetail }) {
  const { group } = detail;
  const userId = useUserId();
  const update = useUpdateGroup(group.id);
  const remove = useDeleteGroup(group.id);
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji);
  const [picking, setPicking] = useState(false);

  // Mesma regra do banco: só quem criou edita, arquiva e exclui.
  const owner = detail.members.find((m) => m.role === 'owner');
  const isOwner = owner?.user_id === userId;
  const changed = !!name.trim() && (name.trim() !== group.name || emoji !== group.emoji);
  const archived = !!group.archived_at;

  async function save() {
    await update.mutateAsync({ name: name.trim(), emoji });
    router.back();
  }

  function toggleArchive() {
    Alert.alert(
      archived ? 'Desarquivar grupo?' : 'Arquivar grupo?',
      archived
        ? 'Ele volta para a lista principal e o código de convite volta a funcionar.'
        : 'Ele sai da lista principal (fica em "Grupos arquivados") e o código de convite para de funcionar. Nada é apagado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: archived ? 'Desarquivar' : 'Arquivar',
          onPress: async () => {
            await update.mutateAsync({ archived_at: archived ? null : new Date().toISOString() });
            if (!archived) router.dismissTo('/');
          },
        },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      `Excluir "${group.name}"?`,
      'O grupo, os lançamentos e os saldos somem para todos os participantes. Não dá para desfazer pelo app.\n\nSe só quer tirar da lista, prefira arquivar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync();
            router.dismissTo('/');
          },
        },
      ],
    );
  }

  return (
    <Screen footer={isOwner ? <Button title="Salvar" onPress={save} disabled={!changed} loading={update.isPending} /> : undefined}>
      <Header title="Editar grupo" />

      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-end' }}>
        <EmojiTile emoji={emoji} size={45} onPress={isOwner ? () => setPicking(true) : undefined} label="Emoji do grupo" />
        <View style={{ flex: 1 }}>
          <Field label="Nome do grupo">
            <Input value={name} onChangeText={setName} maxLength={40} placeholder="Ex.: Casa" editable={isOwner} />
          </Field>
        </View>
      </View>
      {isOwner ? (
        <Text style={{ fontSize: 11, color: colors.muted }}>Toque no emoji para trocar. Muda para todos do grupo.</Text>
      ) : (
        <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
          Só {owner?.display_name ?? 'quem criou o grupo'} pode mudar nome e emoji, arquivar ou excluir.
        </Text>
      )}
      <ErrorText>{update.error?.message}</ErrorText>

      {isOwner ? (
        <View style={{ gap: space.sm, paddingTop: space.xl }}>
          <Button title={archived ? 'Desarquivar grupo' : 'Arquivar grupo'} variant="secondary" onPress={toggleArchive} />
          <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted, textAlign: 'center' }}>
            {archived ? 'Arquivado: fora da lista principal e sem convite.' : 'Arquivar esconde o grupo sem apagar nada.'}
          </Text>
          <Button title="Excluir grupo" variant="danger" icon="trash" onPress={confirmDelete} loading={remove.isPending}
            style={{ marginTop: space.md }} />
          <ErrorText>{remove.error?.message}</ErrorText>
        </View>
      ) : null}

      <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={setEmoji} title="Emoji do grupo" />
    </Screen>
  );
}
