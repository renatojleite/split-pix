import { Pressable, Text, TextInput, View } from 'react-native';

import { formatPercent } from '@/lib/money';
import { colors, space } from '@/theme';
import { Icon } from './icons';
import { SplitBar } from './ui';

export type PercentRow = { key: string; name: string; color: string };

const STEP = 500; // 5%

/** Divide 10000 bp igualmente; o resto vai para os primeiros. */
export function equalBps(n: number): number[] {
  const base = Math.floor(10000 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 10000 - base * n ? 1 : 0));
}

/**
 * Edita percentuais que somam 100%. Com duas pessoas, mexer numa ajusta a outra;
 * com mais, cada linha é livre e a soma aparece embaixo.
 */
export function PercentEditor({ rows, value, onChange }: {
  rows: PercentRow[]; value: number[]; onChange: (bps: number[]) => void;
}) {
  const sum = value.reduce((a, b) => a + b, 0);
  const pair = rows.length === 2;

  function set(i: number, bp: number) {
    const clamped = Math.max(0, Math.min(10000, bp));
    const next = [...value];
    next[i] = clamped;
    if (pair) next[1 - i] = 10000 - clamped;
    onChange(next);
  }

  return (
    <View style={{ gap: space.md }}>
      <SplitBar parts={rows.map((r, i) => ({ color: r.color, bp: value[i] ?? 0 }))} height={14} />
      {rows.map((r, i) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color }} />
          <Text style={{ flex: 1, fontSize: 16, color: colors.text }} numberOfLines={1}>{r.name}</Text>
          <StepButton icon="minus" label={`Diminuir ${r.name}`} onPress={() => set(i, (value[i] ?? 0) - STEP)} />
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 8, height: 40, minWidth: 72, justifyContent: 'center' }}>
            <TextInput
              accessibilityLabel={`Percentual de ${r.name}`}
              value={formatPercent(value[i] ?? 0)}
              onChangeText={(t) => {
                const n = parseFloat(t.replace(',', '.'));
                set(i, Number.isNaN(n) ? 0 : Math.round(n * 100));
              }}
              keyboardType="decimal-pad" selectTextOnFocus
              style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'right', minWidth: 32, padding: 0 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>%</Text>
          </View>
          <StepButton icon="plus" label={`Aumentar ${r.name}`} onPress={() => set(i, (value[i] ?? 0) + STEP)} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => onChange(equalBps(rows.length))} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Dividir igual</Text>
        </Pressable>
        {sum !== 10000 ? (
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.negative }}>
            Soma {formatPercent(sum)}% — precisa dar 100%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'plus' | 'minus'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      {icon === 'plus' ? <Icon name="plus" size={18} /> : <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: colors.text }} />}
    </Pressable>
  );
}
