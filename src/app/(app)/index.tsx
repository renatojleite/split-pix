import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, Logo } from '@/components/icons';
import { Button, Card, EmojiTile, ErrorText, Input, Loading } from '@/components/ui';
import { useGroups, useProfile, useUpdateProfileName } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { describeMyBalance } from '@/lib/describe';
import { colors, space, type } from '@/theme';

export default function Home() {
  const userId = useUserId();
  const groups = useGroups(userId);
  const profile = useProfile(userId);
  const [showArchived, setShowArchived] = useState(false);

  const list = (groups.data ?? []).filter((g) => (showArchived ? g.archived_at : !g.archived_at));
  const archivedCount = (groups.data ?? []).filter((g) => g.archived_at).length;
  const initial = (profile.data?.name || profile.data?.email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={groups.isRefetching} onRefresh={() => { groups.refetch(); }} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Logo size={36} />
            <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5 }}>split·pix</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={() => router.push('/perfil')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.primaryInk }}>{initial}</Text>
          </Pressable>
        </View>

        {profile.data && !profile.data.name ? <AskName userId={userId} /> : null}

        {showArchived ? <Text style={type.title}>Grupos arquivados</Text> : null}

        {groups.isLoading ? <Loading /> : null}
        <ErrorText>{groups.error?.message}</ErrorText>

        {list.map((g) => {
          const status = describeMyBalance(g.myBalance, g.me, g.members);
          return (
            <Card key={g.id} onPress={() => router.push({ pathname: '/g/[id]', params: { id: g.id } })}
              onLongPress={() => groupActions(g.id, g.name)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderRadius: 24 }}>
              <EmojiTile emoji={g.emoji} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 19, fontWeight: '600', color: colors.text }} numberOfLines={1}>{g.name}</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: status.tone === 'neutral' ? '400' : '600',
                  color: status.tone === 'positive' ? colors.positive : status.tone === 'negative' ? colors.negative : colors.muted,
                }}>{status.text}</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Card>
          );
        })}

        {!groups.isLoading && list.length === 0 && !showArchived ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 48 }}>
            <Text style={type.title}>Nenhum grupo ainda</Text>
            <Text style={{ fontSize: 15, color: colors.muted, textAlign: 'center' }}>
              Crie um grupo com seu par ou entre num grupo com o código que te mandaram.
            </Text>
          </View>
        ) : null}

        {archivedCount > 0 || showArchived ? (
          <Pressable onPress={() => setShowArchived((v) => !v)} style={{ alignSelf: 'center', padding: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
              {showArchived ? 'Voltar aos grupos ativos' : `Grupos arquivados (${archivedCount})`}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.lg, paddingTop: space.sm }}>
        <Button title="Participar" icon="qr" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/participar')} />
        <Button title="Novo grupo" icon="plus" style={{ flex: 1 }} onPress={() => router.push('/novo-grupo')} />
      </View>
    </SafeAreaView>
  );
}

/** Toque longo num grupo: atalhos. */
function groupActions(id: string, name: string) {
  const open = (path: '/g/[id]/duplicar' | '/g/[id]/convite') => router.push({ pathname: path, params: { id } });
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: name, options: ['Duplicar grupo', 'Convidar', 'Cancelar'], cancelButtonIndex: 2 },
      (i) => (i === 0 ? open('/g/[id]/duplicar') : i === 1 ? open('/g/[id]/convite') : undefined),
    );
  } else {
    Alert.alert(name, undefined, [
      { text: 'Duplicar grupo', onPress: () => open('/g/[id]/duplicar') },
      { text: 'Convidar', onPress: () => open('/g/[id]/convite') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }
}

function AskName({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const save = useUpdateProfileName(userId);
  return (
    <Card style={{ gap: space.md, backgroundColor: colors.primarySoft }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primaryInk }}>Como quer ser chamado nos grupos?</Text>
      <Input value={name} onChangeText={setName} placeholder="Seu nome" style={{ backgroundColor: colors.surface }} />
      <Button title="Salvar" onPress={() => save.mutate(name)} disabled={!name.trim()} loading={save.isPending} />
    </Card>
  );
}
