import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalancesTab } from '@/components/group/balances-tab';
import { ExpensesTab } from '@/components/group/expenses-tab';
import { SplitTab } from '@/components/group/split-tab';
import { Button, Header, IconButton, IconTile, Loading, Segmented } from '@/components/ui';
import { useGroup, useGroupRealtime } from '@/lib/api';
import { monthStart, today } from '@/lib/dates';
import { colors, space } from '@/theme';

type Tab = 'despesas' | 'saldos' | 'divisao';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  useGroupRealtime(id);
  const [tab, setTab] = useState<Tab>('despesas');
  const [month, setMonth] = useState(monthStart(today()));

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
              <IconTile icon={g.icon} size={36} />
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }} numberOfLines={1}>{g.name}</Text>
            </View>
          }
          right={<IconButton name="share" label="Convidar" onPress={() => router.push({ pathname: '/g/[id]/convite', params: { id } })} />}
        />
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: 'despesas', label: 'Despesas' },
          { value: 'saldos', label: 'Saldos' },
          { value: 'divisao', label: 'Divisão' },
        ]} />
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'despesas' ? <ExpensesTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'saldos' ? <BalancesTab detail={group.data} month={month} onMonth={setMonth} /> : null}
        {tab === 'divisao' ? <SplitTab detail={group.data} /> : null}
      </View>

      {tab === 'despesas' ? (
        <View style={{ position: 'absolute', bottom: 28, alignSelf: 'center' }}>
          <Button title="Adicionar" icon="plus" onPress={() => router.push({ pathname: '/g/[id]/item', params: { id } })}
            style={{ borderRadius: 28, paddingHorizontal: 28, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
