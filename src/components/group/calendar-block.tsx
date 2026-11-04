import { Pressable, Text, View } from 'react-native';

import { dayLabel, monthGrid, today } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { PREF, usePref } from '@/lib/prefs';
import type { Entry } from '@/lib/types';
import { colors, space } from '@/theme';
import { Icon } from '../icons';
import { Card } from '../ui';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Calendário do mês dentro da aba Despesas: dias com lançamento em destaque
 * (pontinhos = quantidade). Tocar num dia filtra a lista; tocar de novo limpa.
 */
export function CalendarBlock({ month, entries, selected, onSelect }: {
  month: string; entries: Entry[]; selected: string | null; onSelect: (day: string | null) => void;
}) {
  const [open, setOpen] = usePref(PREF.calendarOpen, false);
  const t = today();

  const byDay = new Map<string, { count: number; spent: number }>();
  for (const e of entries) {
    const d = byDay.get(e.occurred_on) ?? { count: 0, spent: 0 };
    d.count += 1;
    if (e.type === 'expense') d.spent += e.amount_cents;
    byDay.set(e.occurred_on, d);
  }
  const daysWithEntries = byDay.size;

  return (
    <Card style={{ padding: 0 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg, minHeight: 52 }}>
        <Icon name="calendar" size={18} color={colors.primary} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>Calendário</Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>
          {daysWithEntries ? `${daysWithEntries} ${daysWithEntries === 1 ? 'dia' : 'dias'} com lançamento` : 'sem lançamentos'}
        </Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <Icon name="chevron-right" size={18} color={colors.muted} />
        </View>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderColor: colors.divider, paddingHorizontal: space.sm, paddingVertical: space.sm, gap: 2 }}>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted }}>{w}</Text>
            ))}
          </View>
          {monthGrid(month).map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1, height: 50 }} />;
                const info = byDay.get(d);
                const isSel = d === selected;
                const has = !!info;
                return (
                  <Pressable key={d} disabled={!has && !isSel} onPress={() => onSelect(isSel ? null : d)}
                    accessibilityRole="button" accessibilityState={{ selected: isSel, disabled: !has }}
                    accessibilityLabel={has ? `${dayLabel(d)}: ${info.count} lançamentos, ${formatBRL(info.spent)}` : dayLabel(d)}
                    style={{ flex: 1, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 40, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3,
                      backgroundColor: isSel ? colors.primary : has ? colors.primarySoft : 'transparent',
                      borderWidth: d === t && !isSel ? 1.5 : 0, borderColor: colors.primary }}>
                      <Text style={{ fontSize: 15, fontWeight: has || isSel ? '700' : '400',
                        color: isSel ? '#FFFFFF' : has ? colors.primaryInk : colors.muted }}>
                        {Number(d.slice(8))}
                      </Text>
                      {has ? (
                        <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                          {Array.from({ length: Math.min(info.count, 3) }, (_, k) => (
                            <View key={k} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSel ? '#FFFFFF' : colors.primary }} />
                          ))}
                        </View>
                      ) : <View style={{ height: 5 }} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', paddingTop: 4 }}>
            Toque num dia destacado para ver só os lançamentos dele.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
