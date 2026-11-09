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
  // Comentários: amarelo pastel (post-it)
  note: '#FEF9C3',
  noteBorder: '#FDE68A',
  noteStrong: '#FACC15',
  noteInk: '#713F12',
} as const;

export const radius = { card: 21, row: 18, input: 14, chip: 15, pill: 999 } as const;

export const space = { xs: 3, sm: 7, md: 11, lg: 14, xl: 18, xxl: 21, xxxl: 29 } as const;

export const type = {
  screenTitle: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  name: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 12, color: colors.muted },
};

// Emoji padrão quando o item não tem o seu nem a categoria.
export const defaultEmoji = { expense: '🧾', income: '💰', transfer: '🔁', group: '🏠' } as const;
