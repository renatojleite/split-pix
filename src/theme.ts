// Tokens do design system (ver PRD › Design system). Cores escolhidas para
// contraste ≥ 4,5:1 em texto pequeno sobre fundo branco.
export const colors = {
  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  primarySoft: '#DBEAFE',
  primaryInk: '#1E3A8A',
  surface: '#FFFFFF',
  card: '#F4F4F5',
  divider: '#E4E4E7',
  text: '#111111',
  textSoft: '#3F3F46',
  muted: '#6B6B70',
  positive: '#15803D',
  positiveSoft: '#F0FDF4',
  negative: '#DC2626',
  negativeSoft: '#FEF2F2',
  scrim: 'rgba(0,0,0,0.4)',
  inverse: '#111111',
} as const;

export const radius = { card: 19, row: 16, input: 13, chip: 14, pill: 999 } as const;

export const space = { xs: 3, sm: 6, md: 10, lg: 13, xl: 16, xxl: 19, xxxl: 26 } as const;

export const type = {
  screenTitle: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  title: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  name: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 13, color: colors.text },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 11, color: colors.muted },
};

// Emoji padrão quando o item não tem o seu nem a categoria.
export const defaultEmoji = { expense: '🧾', income: '💰', transfer: '🔁', group: '🏠' } as const;
