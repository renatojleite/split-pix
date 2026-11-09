import { Text, View } from 'react-native';

import { formatBRL } from '@/lib/money';
import { shownPeople, summarize } from '@/lib/summary';
import type { Category, Entry, Member } from '@/lib/types';
import { colors, radius, space } from '@/theme';

const pct = (part: number, total: number) =>
  total ? `${((part / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '0%';

function Box({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.divider,
      padding: space.lg }, style]}>
      {children}
    </View>
  );
}

/** Topo do mês: "Total de despesas" e "Cota por pessoa". */
export function MonthTotals({ entries, members, categories, meId }: {
  entries: Entry[]; members: Member[]; categories: Category[]; meId?: string;
}) {
  const s = summarize(entries, members, categories);
  const expenses = entries.filter((e) => e.type === 'expense');
  const sharing = shownPeople(s.people, members).filter((p) => p.share > 0);
  const equal = sharing.length > 1 && sharing.every((p) => Math.abs(p.share - sharing[0].share) <= 1);
  const mine = s.people.find((p) => p.memberId === meId)?.share ?? 0;
  const cota = equal ? Math.round(s.spent / sharing.length) : mine;
  const label = equal ? `${pct(1, sharing.length).replace(',0%', '%')} cada` : `Sua parte · ${pct(mine, s.spent)} do total`;

  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <Box style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12, color: colors.textSoft }}>Total de despesas</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }} adjustsFontSizeToFit numberOfLines={1}>{formatBRL(s.spent)}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{expenses.length} {expenses.length === 1 ? 'lançamento' : 'lançamentos'}</Text>
      </Box>
      <Box style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12, color: colors.textSoft }}>Cota por pessoa</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }} adjustsFontSizeToFit numberOfLines={1}>{formatBRL(cota)}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{s.spent ? label : 'Sem despesas ainda'}</Text>
      </Box>
    </View>
  );
}

/** "Quanto cada pessoa pagou" no mês, com barra do quanto isso é do total, e o acerto do mês. */
export function PeopleBlock({ entries, members, categories }: {
  entries: Entry[]; members: Member[]; categories: Category[]; meId?: string;
}) {
  const s = summarize(entries, members, categories);
  const expenses = entries.filter((e) => e.type === 'expense');
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? '—';
  const people = shownPeople(s.people, members);
  if (!expenses.length) return null;

  return (
    <Box style={{ gap: space.lg }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Quanto cada pessoa pagou</Text>
      {people.map((p) => {
        const m = members.find((x) => x.id === p.memberId)!;
        const count = expenses.filter((e) => e.paid_by === p.memberId).length;
        const ratio = s.spent ? p.paid / s.spent : 0;
        return (
          <View key={p.memberId} style={{ gap: 5 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{m.display_name}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{formatBRL(p.paid)}</Text>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.card, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(ratio * 1000) / 10}%`, height: 10, borderRadius: 5, backgroundColor: m.color }} />
            </View>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {pct(p.paid, s.spent)} do total · {count} {count === 1 ? 'despesa' : 'despesas'}
            </Text>
          </View>
        );
      })}
      <View style={{ borderTopWidth: 1, borderColor: colors.divider, paddingTop: space.md, gap: 4 }}>
        {s.transfers.length ? s.transfers.map((t, i) => (
          <Text key={i} style={{ fontSize: 13, color: colors.text }}>
            ⚖️ Acerto do mês: <Text style={{ fontWeight: '700' }}>{name(t.from)}</Text> deve{' '}
            <Text style={{ fontWeight: '700', color: colors.negative }}>{formatBRL(t.cents)}</Text> a <Text style={{ fontWeight: '700' }}>{name(t.to)}</Text>
          </Text>
        )) : (
          <Text style={{ fontSize: 13, color: colors.positive, fontWeight: '600' }}>✓ Ninguém deve nada neste mês</Text>
        )}
      </View>
    </Box>
  );
}
