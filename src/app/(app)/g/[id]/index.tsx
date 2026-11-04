import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/action-sheet';

import { BalancesTab } from '@/components/group/balances-tab';
import { ExpensesTab } from '@/components/group/expenses-tab';
import { SplitTab } from '@/components/group/split-tab';
import { SummaryTab } from '@/components/group/summary-tab';
import { Button, EmojiTile, Header, IconButton, Loading, Segmented } from '@/components/ui';
import { useGroup, useGroupRealtime } from '@/lib/api';
import { monthStart, today } from '@/lib/dates';
import { colors, space } from '@/theme';

type Tab = 'despesas' | 'saldos' | 'resumo' | 'divisao';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  useGroupRealtime(id);
  const [tab, setTab] = useState<Tab>('despesas');
  const [month, setMonth] = useState(monthStart(today()));
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

  if (!group.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        {group.error ? <Text style={{ padding: 24, color: colors.negative }}>{group.error.message}</Text> : <Loading />}
      </SafeAreaView>
    );
  }

  const { group: g } = group.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
        <Header
          center={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <EmojiTile emoji={g.emoji} size={36} />
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }} numberOfLines={1}>{g.name}</Text>
            </View>
          }
          right={
            <View style={{ flexDirection: 'row' }}>
              <IconButton name="share" label="Convidar" onPress={() => router.push({ pathname: '/g/[id]/convite', params: { id } })} />
              <IconButton name="more" label="Mais opções" onPress={() => setMenuOpen(true)} />
            </View>
          }
        />
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: 'despesas', label: 'Despesas' },
          { value: 'saldos', label: 'Saldos' },
          { value: 'resumo', label: 'Resumo' },
          { value: 'divisao', label: 'Divisão' },
        ]} />
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'despesas' ? <ExpensesTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'saldos' ? <BalancesTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'resumo' ? <SummaryTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'divisao' ? <SplitTab detail={group.data} /> : null}
      </View>

      {tab === 'despesas' ? (
        // Acima da barra de navegação do Android (o app desenha por baixo dela).
        <View style={{ position: 'absolute', bottom: insets.bottom + 20, alignSelf: 'center' }}>
          <Button title="Adicionar" icon="plus" onPress={() => router.push({ pathname: '/g/[id]/item', params: { id } })}
            style={{ borderRadius: 28, paddingHorizontal: 28, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }} />
        </View>
      ) : null}

      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={`${g.emoji} ${g.name}`} actions={[
        { emoji: '💸', label: 'Criar pagamento Pix', hint: 'QR ou código para alguém te pagar, com qualquer valor',
          onPress: () => router.push({ pathname: '/g/[id]/pix', params: { id } }) },
        { emoji: '📋', label: 'Duplicar grupo', hint: 'Mesmas pessoas, categorias e divisão',
          onPress: () => router.push({ pathname: '/g/[id]/duplicar', params: { id } }) },
        { emoji: '🔗', label: 'Convidar', hint: 'Código, QR e link do app',
          onPress: () => router.push({ pathname: '/g/[id]/convite', params: { id } }) },
      ]} />
    </SafeAreaView>
  );
}
