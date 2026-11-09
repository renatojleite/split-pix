import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { addMonths, monthLabel } from '@/lib/dates';
import { colors } from '@/theme';
import { IconButton } from '../ui';

/** Mês com setas; `extra` aparece ao lado do nome (ex.: botão do calendário). */
export function MonthNav({ month, onMonth, extra }: { month: string; onMonth: (m: string) => void; extra?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton name="chevron-left" label="Mês anterior" onPress={() => onMonth(addMonths(month, -1))} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{monthLabel(month)}</Text>
        {extra}
      </View>
      <IconButton name="chevron-right" label="Próximo mês" onPress={() => onMonth(addMonths(month, 1))} />
    </View>
  );
}
