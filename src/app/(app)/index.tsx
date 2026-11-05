import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/action-sheet';
import { Icon, Logo } from '@/components/icons';
import { SortableList } from '@/components/sortable-list';
import { UpdateBanner } from '@/components/update-banner';
import { Button, Card, EmojiTile, ErrorText, IconButton, Input, Loading } from '@/components/ui';
import { useGroups, useProfile, useUpdateProfileName, type GroupSummary } from '@/lib/api';
import { checkForUpdateNow, versionLabel } from '@/lib/app-version';
import { useUserId } from '@/lib/auth';
import { describeMyBalance } from '@/lib/describe';
import { PREF, usePref } from '@/lib/prefs';
import { colors, space, type } from '@/theme';

const ROW = 70; // altura fixa do cartão de grupo (a lista arrastável precisa)

/** Ordem salva primeiro; grupos novos (fora da ordem) vão para o topo, mais recentes antes. */
function applyOrder(groups: GroupSummary[], order: string[]): GroupSummary[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const fresh = groups.filter((g) => !rank.has(g.id));
  const known = groups.filter((g) => rank.has(g.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...fresh, ...known];
}

export default function Home() {
  const userId = useUserId();
  const groups = useGroups(userId);
  const profile = useProfile(userId);
  const [showArchived, setShowArchived] = useState(false);
  const [order, setOrder] = usePref<string[]>(PREF.groupOrder, []);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const all = applyOrder(groups.data ?? [], order);
  const list = all.filter((g) => (showArchived ? g.archived_at : !g.archived_at));

  // Reordenou os visíveis: eles assumem as posições deles, os demais (arquivados ou não) seguem atrás.
  function reorder(ids: string[]) {
    setOrder([...ids, ...all.map((g) => g.id).filter((id) => !ids.includes(id))]);
  }

  async function checkUpdate() {
    setChecking(true);
    await checkForUpdateNow();
    setChecking(false);
  }
  const archivedCount = (groups.data ?? []).filter((g) => g.archived_at).length;
  const initial = (profile.data?.name || profile.data?.email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <ScrollView scrollEnabled={!dragging}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={groups.isRefetching} onRefresh={() => { groups.refetch(); }} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 51 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Logo size={29} />
            <Text style={{ fontSize: 21, fontWeight: '700', color: colors.text, letterSpacing: -0.4 }}>split·pix</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {checking ? <View style={{ width: 35, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
              : <IconButton name="more" label="Mais opções" onPress={() => setMenuOpen(true)} />}
            <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={() => router.push('/perfil')}
              style={{ width: 35, height: 35, borderRadius: 18, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primaryInk }}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        <UpdateBanner />
        {profile.data && !profile.data.name ? <AskName userId={userId} /> : null}

        {showArchived ? <Text style={type.title}>Grupos arquivados</Text> : null}

        {groups.isLoading ? <Loading /> : null}
        <ErrorText>{groups.error?.message}</ErrorText>

        {list.length > 1 ? (
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: -space.sm }}>Arraste pelo ≡ para mudar a ordem.</Text>
        ) : null}
        <SortableList key={list.map((g) => g.id).join(',')} items={list} rowHeight={ROW} gap={space.lg}
          onReorder={reorder} onDragging={setDragging}
          renderItem={(g, handle) => {
            const status = describeMyBalance(g.myBalance, g.me, g.members);
            return (
              <Card onPress={() => router.push({ pathname: '/g/[id]', params: { id: g.id } })}
                onLongPress={() => groupActions(g.id, g.name)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, height: ROW, paddingVertical: 0, paddingRight: 3, borderRadius: 19 }}>
                <EmojiTile emoji={g.emoji} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{g.name}</Text>
                  <Text numberOfLines={1} style={{
                    fontSize: 11,
                    fontWeight: status.tone === 'neutral' ? '400' : '600',
                    color: status.tone === 'positive' ? colors.positive : status.tone === 'negative' ? colors.negative : colors.muted,
                  }}>{status.text}</Text>
                </View>
                {handle(
                  <View accessibilityLabel={`Arrastar ${g.name}`} style={{ width: 38, height: ROW, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="grip" size={18} color={colors.muted} />
                  </View>,
                )}
              </Card>
            );
          }} />

        {!groups.isLoading && list.length === 0 && !showArchived ? (
          <View style={{ alignItems: 'center', gap: 6, paddingVertical: 38 }}>
            <Text style={type.title}>Nenhum grupo ainda</Text>
            <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
              Crie um grupo com seu par ou entre num grupo com o código que te mandaram.
            </Text>
          </View>
        ) : null}

        {archivedCount > 0 || showArchived ? (
          <Pressable onPress={() => setShowArchived((v) => !v)} style={{ alignSelf: 'center', padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
              {showArchived ? 'Voltar aos grupos ativos' : `Grupos arquivados (${archivedCount})`}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.lg, paddingTop: space.sm }}>
        <Button title="Participar" icon="qr" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/participar')} />
        <Button title="Novo grupo" icon="plus" style={{ flex: 1 }} onPress={() => router.push('/novo-grupo')} />
      </View>
      <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center', paddingBottom: space.sm, opacity: 0.8 }}>
        split·pix {versionLabel()}
      </Text>

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} actions={[
        { emoji: '🔄', label: 'Atualizar versão', hint: 'Procura agora e já abre a versão nova', onPress: checkUpdate },
        { emoji: '👤', label: 'Perfil', hint: 'Seu nome e sair da conta', onPress: () => router.push('/perfil') },
      ]} />
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
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primaryInk }}>Como quer ser chamado nos grupos?</Text>
      <Input value={name} onChangeText={setName} placeholder="Seu nome" style={{ backgroundColor: colors.surface }} />
      <Button title="Salvar" onPress={() => save.mutate(name)} disabled={!name.trim()} loading={save.isPending} />
    </Card>
  );
}
