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

export const radius = { card: 24, row: 20, input: 16, chip: 18, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const type = {
  screenTitle: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  name: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  label: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 13, color: colors.muted },
};

// Cores e ícones disponíveis para grupos (o app final pode trocar por emoji).
export const groupIcons = ['home', 'heart', 'plane', 'gift', 'cart', 'star'] as const;
export type GroupIcon = (typeof groupIcons)[number];

export const iconTints: Record<string, { bg: string; ink: string }> = {
  home: { bg: '#DBEAFE', ink: '#1D4ED8' },
  heart: { bg: '#FCE7F3', ink: '#BE185D' },
  plane: { bg: '#FFEDD5', ink: '#C2410C' },
  gift: { bg: '#DCFCE7', ink: '#15803D' },
  cart: { bg: '#DCFCE7', ink: '#15803D' },
  star: { bg: '#FEF9C3', ink: '#A16207' },
  bolt: { bg: '#FEF9C3', ink: '#A16207' },
  child: { bg: '#FFEDD5', ink: '#C2410C' },
  party: { bg: '#F3E8FF', ink: '#7E22CE' },
  car: { bg: '#E0F2FE', ink: '#0369A1' },
  tag: { bg: '#F4F4F5', ink: '#3F3F46' },
  transfer: { bg: '#E0E7FF', ink: '#3730A3' },
  income: { bg: '#DCFCE7', ink: '#15803D' },
};
