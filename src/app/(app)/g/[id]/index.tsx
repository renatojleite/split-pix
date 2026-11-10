import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ActionSheet } from '@/components/action-sheet';

import { BalancesTab } from '@/components/group/balances-tab';
import { ExpensesTab } from '@/components/group/expenses-tab';
import { SplitTab } from '@/components/group/split-tab';
import { SummaryTab } from '@/components/group/summary-tab';
import { Button, EmojiTile, Header, IconButton, Loading, Segmented } from '@/components/ui';
import { useGroup, useGroupRealtime, useMarkGroupSeen } from '@/lib/api';
import { monthStart, today } from '@/lib/dates';
import { colors, space } from '@/theme';

type Tab = 'despesas' | 'saldos' | 'resumo' | 'divisao';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  useGroupRealtime(id);
  const [tab, setTab] = useState<Tab>('despesas');
  const [selecting, setSelecting] = useState(false);
  const [month, setMonth] = useState(monthStart(today()));
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  // Ao abrir: marca o grupo como visto e guarda quando tinha sido visto antes;
  // o que outras pessoas incluíram depois disso aparece em destaque nesta visita.
  const markSeen = useMarkGroupSeen();
  const [newSince, setNewSince] = useState<string | null>(null);
  useEffect(() => {
    markSeen.mutate(id, { onSuccess: (prev) => setNewSince(prev ?? null) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!group.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        {group.error ? <Text style={{ padding: 21, color: colors.negative }}>{group.error.message}</Text> : <Loading />}
      </SafeAreaView>
    );
  }

  const { group: g } = group.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
        <Header
          center={
            <Pressable onPress={() => router.push({ pathname: '/g/[id]/editar', params: { id } })} accessibilityRole="button"
              accessibilityLabel={`Editar ${g.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <EmojiTile emoji={g.emoji} size={32} />
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }} numberOfLines={1}>{g.name}</Text>
            </Pressable>
          }
          right={
            <View style={{ flexDirection: 'row' }}>
              <IconButton name="share" label="Convidar" onPress={() => router.push({ pathname: '/g/[id]/convite', params: { id } })} />
              <IconButton name="more" label="Mais opções" onPress={() => setMenuOpen(true)} />
            </View>
          }
        />
        <View style={{ marginBottom: space.sm }}>
          <Segmented<Tab> value={tab} onChange={(t) => { setTab(t); setSelecting(false); }} options={[
            { value: 'despesas', label: 'Despesas' },
            { value: 'saldos', label: 'Saldos' },
            { value: 'resumo', label: 'Resumo' },
            { value: 'divisao', label: 'Divisão e configurações', icon: 'settings', iconOnly: true },
          ]} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'despesas' ? <ExpensesTab detail={group.data} month={month} onMonth={setMonth} onSelecting={setSelecting} newSince={newSince} /> : null}
        {tab === 'saldos' ? <BalancesTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'resumo' ? <SummaryTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'divisao' ? <SplitTab detail={group.data} /> : null}
      </View>

      {tab === 'despesas' && !selecting ? (
        // Degradê branco por cima da lista, para o botão flutuar sem brigar com os itens.
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 110 }}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
          </Svg>
        </View>
      ) : null}
      {tab === 'despesas' && !selecting ? (
        // Acima da barra de navegação do Android (o app desenha por baixo dela).
        <View style={{ position: 'absolute', bottom: insets.bottom + 18, alignSelf: 'center', zIndex: 10, elevation: 10 }}>
          <Button title="Adicionar" icon="plus" onPress={() => router.push({ pathname: '/g/[id]/novo', params: { id } })}
            style={{ borderRadius: 24, paddingHorizontal: 24, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 11, shadowOffset: { width: 0, height: 6 } }} />
        </View>
      ) : null}

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={`${g.emoji} ${g.name}`} actions={[
        { emoji: '✏️', label: 'Editar grupo', hint: 'Nome, emoji, arquivar ou excluir',
          onPress: () => router.push({ pathname: '/g/[id]/editar', params: { id } }) },
        { emoji: '💸', label: 'Criar pagamento Pix', hint: 'Cobrar ou pagar com QR/código, qualquer valor',
          onPress: () => router.push({ pathname: '/g/[id]/pix', params: { id } }) },
        { emoji: '✨', label: 'Ler comprovante com IA', hint: 'Print ou PDF do banco: a IA preenche o lançamento',
          onPress: () => router.push({ pathname: '/comprovante', params: { groupId: id } }) },
        { emoji: '📊', label: 'Compartilhar relatório', hint: 'Resumido ou extrato completo, pelo WhatsApp',
          onPress: () => router.push({ pathname: '/g/[id]/relatorio', params: { id } }) },
        { emoji: '📋', label: 'Duplicar grupo', hint: 'Mesmas pessoas, categorias e divisão',
          onPress: () => router.push({ pathname: '/g/[id]/duplicar', params: { id } }) },
        { emoji: '🔗', label: 'Convidar', hint: 'Código, QR e link do app',
          onPress: () => router.push({ pathname: '/g/[id]/convite', params: { id } }) },
      ]} />
    </SafeAreaView>
  );
}
