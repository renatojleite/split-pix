import { useRef } from 'react';
import { Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { dayLabel, monthGrid, today } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import type { Entry } from '@/lib/types';
import { colors, space } from '@/theme';
import { Icon } from '../icons';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEK_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CELL = 52; // largura de cada dia na faixa (com o espaço entre eles)

export type CalendarMode = 'off' | 'week' | 'month';

/** Botão "📅 Calendário ▾" que fica ao lado do mês. */
export function CalendarToggle({ mode, onMode }: { mode: CalendarMode; onMode: (m: CalendarMode) => void }) {
  const open = mode !== 'off';
  return (
    <Pressable onPress={() => onMode(open ? 'off' : 'week')} accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? 'Fechar calendário' : 'Abrir calendário'} hitSlop={8}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: open ? colors.primary : pressed ? colors.divider : colors.primarySoft })}>
      <Icon name="calendar" size={16} color={open ? '#FFFFFF' : colors.primary} />
    </Pressable>
  );
}

/**
 * Calendário da aba Despesas, aberto pelo botão ao lado do mês: uma faixa com os dias
 * (rola para os lados) ou o mês inteiro. Dias com lançamento têm destaque; tocar filtra
 * a lista, tocar de novo limpa.
 */
export function CalendarPanel({ month, entries, selected, onSelect, mode, onMode }: {
  month: string; entries: Entry[]; selected: string | null; onSelect: (day: string | null) => void;
  mode: CalendarMode; onMode: (m: CalendarMode) => void;
}) {
  const t = today();
  const scroller = useRef<ScrollViewInstance>(null);
  const scrolledFor = useRef<string | null>(null);
  const viewW = useRef(0);

  const byDay = new Map<string, { count: number; spent: number }>();
  for (const e of entries) {
    const d = byDay.get(e.occurred_on) ?? { count: 0, spent: 0 };
    d.count += 1;
    if (e.type === 'expense') d.spent += e.amount_cents;
    byDay.set(e.occurred_on, d);
  }
  if (mode === 'off') return null;

  const days = monthGrid(month).flat().filter((d): d is string => !!d);
  // Abre com o dia de hoje no centro (fora do mês atual: o dia escolhido ou o último com lançamento).
  const focus = days.includes(t) ? t : selected ?? [...byDay.keys()].sort().at(-1) ?? days[0];
  const focusIndex = Math.max(0, days.indexOf(focus));

  // Centraliza o dia em foco assim que a faixa tem largura conhecida.
  function center() {
    const key = `${month}|${focus}`;
    if (!viewW.current || scrolledFor.current === key) return;
    scrolledFor.current = key;
    const x = space.sm + focusIndex * CELL + (CELL - 6) / 2 - viewW.current / 2;
    scroller.current?.scrollTo({ x: Math.max(0, x), animated: false });
  }

  const label = (d: string) => {
    const info = byDay.get(d);
    return info ? `${dayLabel(d)}: ${info.count} lançamentos, ${formatBRL(info.spent)}` : dayLabel(d);
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 19, paddingVertical: space.sm, gap: 4 }}>
      {mode === 'week' ? (
        <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.sm, gap: 6 }}
          onLayout={(e) => { viewW.current = e.nativeEvent.layout.width; center(); }}
          onContentSizeChange={center}>
          {days.map((d) => {
            const has = byDay.has(d);
            const isSel = d === selected;
            const weekday = WEEK_SHORT[new Date(`${d}T12:00:00`).getDay()];
            return (
              <Pressable key={d} disabled={!has && !isSel} onPress={() => onSelect(isSel ? null : d)} accessibilityRole="button"
                accessibilityState={{ selected: isSel, disabled: !has }} accessibilityLabel={label(d)}
                style={{ width: CELL - 6, paddingVertical: 6, borderRadius: 12, alignItems: 'center', gap: 1,
                  backgroundColor: isSel ? colors.primary : has ? colors.primarySoft : 'transparent',
                  borderWidth: d === t && !isSel ? 1.5 : 0, borderColor: colors.primary }}>
                <Text style={{ fontSize: 11, color: isSel ? colors.primarySoft : colors.muted }}>{weekday}</Text>
                <Text style={{ fontSize: 16, fontWeight: has || isSel ? '800' : '500', color: isSel ? '#FFFFFF' : has ? colors.primaryInk : colors.textSoft }}>
                  {Number(d.slice(8))}
                </Text>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? (isSel ? '#FFFFFF' : colors.primary) : 'transparent' }} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: space.sm, gap: 2 }}>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.muted }}>{w}</Text>
            ))}
          </View>
          {monthGrid(month).map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1, height: 44 }} />;
                const info = byDay.get(d);
                const isSel = d === selected;
                const has = !!info;
                return (
                  <Pressable key={d} disabled={!has && !isSel} onPress={() => onSelect(isSel ? null : d)}
                    accessibilityRole="button" accessibilityState={{ selected: isSel, disabled: !has }} accessibilityLabel={label(d)}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 35, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2,
                      backgroundColor: isSel ? colors.primary : has ? colors.primarySoft : 'transparent',
                      borderWidth: d === t && !isSel ? 1.5 : 0, borderColor: colors.primary }}>
                      <Text style={{ fontSize: 13, fontWeight: has || isSel ? '700' : '400', color: isSel ? '#FFFFFF' : has ? colors.primaryInk : colors.muted }}>
                        {Number(d.slice(8))}
                      </Text>
                      {has ? (
                        <View style={{ flexDirection: 'row', gap: 2, height: 4 }}>
                          {Array.from({ length: Math.min(info.count, 3) }, (_, k) => (
                            <View key={k} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSel ? '#FFFFFF' : colors.primary }} />
                          ))}
                        </View>
                      ) : <View style={{ height: 4 }} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <Pressable onPress={() => onMode(mode === 'week' ? 'month' : 'week')} hitSlop={6} accessibilityRole="button"
        style={{ alignSelf: 'center', paddingHorizontal: space.md, paddingVertical: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
          {mode === 'week' ? '▾ Ver o mês inteiro' : '▴ Mostrar só a faixa de dias'}
        </Text>
      </Pressable>
    </View>
  );
}
