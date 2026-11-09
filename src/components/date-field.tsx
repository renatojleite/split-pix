import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, addMonths, monthGrid, monthLabel, monthStart, shortDate, today } from '@/lib/dates';
import { colors, radius, space } from '@/theme';
import { Icon } from './icons';
import { IconButton } from './ui';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
/** Campo de data: toca e abre um calendário. Atalhos Hoje/Ontem e setas de dia ao lado. */
export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.input, height: 50 }}>
        <IconButton name="chevron-left" label="Dia anterior" onPress={() => onChange(addDays(value, -1))} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Data: ${shortDate(value)}. Abrir calendário`}
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({ flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: pressed ? 0.6 : 1 })}>
          <Icon name="calendar" size={18} color={colors.primary} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{shortDate(value)}</Text>
        </Pressable>
        <IconButton name="chevron-right" label="Próximo dia" onPress={() => onChange(addDays(value, 1))} />
      </View>
      <CalendarSheet visible={open} value={value} onClose={() => setOpen(false)}
        onPick={(d) => { onChange(d); setOpen(false); }} />
    </>
  );
}

function CalendarSheet({ visible, value, onClose, onPick }: {
  visible: boolean; value: string; onClose: () => void; onPick: (iso: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(monthStart(value));
  const t = today();
  const weeks = monthGrid(month);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}
      onShow={() => setMonth(monthStart(value))} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Fechar calendário" />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: insets.bottom + space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton name="chevron-left" label="Mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{monthLabel(month)}</Text>
          <IconButton name="chevron-right" label="Próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
        </View>

        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted }}>{w}</Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((d, di) => {
              if (!d) return <View key={di} style={{ flex: 1, height: 41 }} />;
              const selected = d === value;
              const isToday = d === t;
              return (
                <Pressable key={d} onPress={() => onPick(d)} accessibilityRole="button"
                  accessibilityState={{ selected }} accessibilityLabel={shortDate(d)}
                  style={{ flex: 1, height: 41, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderWidth: isToday && !selected ? 1.5 : 0, borderColor: colors.primary }}>
                    <Text style={{ fontSize: 14, fontWeight: selected || isToday ? '700' : '400',
                      color: selected ? '#FFFFFF' : isToday ? colors.primary : colors.text }}>
                      {Number(d.slice(8))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: space.sm, paddingTop: space.sm }}>
          {[['Hoje', t], ['Ontem', addDays(t, -1)]].map(([label, d]) => (
            <Pressable key={label} onPress={() => onPick(d)} accessibilityRole="button"
              style={({ pressed }) => ({ flex: 1, height: 42, borderRadius: radius.input, backgroundColor: colors.card,
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
