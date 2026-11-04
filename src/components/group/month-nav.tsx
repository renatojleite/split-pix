import { Text, View } from 'react-native';

import { addMonths, monthLabel } from '@/lib/dates';
import { colors } from '@/theme';
import { IconButton } from '../ui';

export function MonthNav({ month, onMonth }: { month: string; onMonth: (m: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton name="chevron-left" label="Mês anterior" onPress={() => onMonth(addMonths(month, -1))} />
      <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{monthLabel(month)}</Text>
      <IconButton name="chevron-right" label="Próximo mês" onPress={() => onMonth(addMonths(month, 1))} />
    </View>
  );
}
