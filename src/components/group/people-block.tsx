import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatBRL } from '@/lib/money';
import { PREF, usePref } from '@/lib/prefs';
import { summarize } from '@/lib/summary';
import type { Category, Entry, Member } from '@/lib/types';
import { colors, space } from '@/theme';
import { Icon } from '../icons';
import { Avatar, Card } from '../ui';

/**
 * Bloco "Por pessoa" do mês: gasto e saldo de cada um. Recolhível; "Fixar"
 * deixa sempre aberto (preferência guardada no celular, vale para todos os grupos).
 */
export function PeopleBlock({ entries, members, categories, meId }: {
  entries: Entry[]; members: Member[]; categories: Category[]; meId?: string;
}) {
  const [pinned, setPinned] = usePref(PREF.peoplePinned, false);
  const [open, setOpen] = useState(pinned);
  const expanded = pinned || open;
  const s = summarize(entries, members, categories);

  return (
    <Card style={{ padding: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingLeft: space.lg }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} disabled={pinned}
          onPress={() => setOpen(!open)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Saldo e gasto por pessoa</Text>
          {!pinned ? (
            <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </View>
          ) : null}
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: pinned }} accessibilityLabel="Deixar fixo aberto"
          onPress={() => { setPinned(!pinned); setOpen(true); }} hitSlop={6}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.lg, paddingVertical: 14 }}>
          <Icon name="pin" size={16} color={pinned ? colors.primary : colors.muted} strokeWidth={pinned ? 2.5 : 2} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: pinned ? colors.primary : colors.muted }}>
            {pinned ? 'Fixado' : 'Fixar'}
          </Text>
        </Pressable>
      </View>

      {expanded ? (
        <View style={{ borderTopWidth: 1, borderColor: colors.divider }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: 10 }}>
            <Text style={{ flex: 1, fontSize: 12, color: colors.muted }}>Pessoa</Text>
            <Text style={{ width: 92, textAlign: 'right', fontSize: 12, color: colors.muted }}>Gastou</Text>
            <Text style={{ width: 96, textAlign: 'right', fontSize: 12, color: colors.muted }}>Saldo</Text>
          </View>
          {s.people.map((p) => {
            const m = members.find((x) => x.id === p.memberId)!;
            return (
              <View key={p.memberId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingVertical: 10 }}>
                <Avatar name={m.display_name} color={m.color} size={28} />
                <Text style={{ flex: 1, fontSize: 15, color: colors.text }} numberOfLines={1}>
                  {m.id === meId ? `${m.display_name} (eu)` : m.display_name}
                </Text>
                <View style={{ width: 92, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{formatBRL(p.share)}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>pagou {formatBRL(p.paid)}</Text>
                </View>
                <Text style={{ width: 96, textAlign: 'right', fontSize: 15, fontWeight: '700',
                  color: p.balance > 0 ? colors.positive : p.balance < 0 ? colors.negative : colors.muted }}>
                  {formatBRL(p.balance, { sign: true })}
                </Text>
              </View>
            );
          })}
          <Text style={{ fontSize: 12, color: colors.muted, paddingHorizontal: space.lg, paddingBottom: 12 }}>
            Gastou = sua parte nas despesas do mês. Saldo do mês: + tem a receber, − tem a pagar.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
