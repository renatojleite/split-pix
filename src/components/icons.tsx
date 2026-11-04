import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

export type IconName =
  | 'back' | 'chevron-right' | 'chevron-left' | 'plus' | 'share' | 'qr' | 'check' | 'close'
  | 'home' | 'heart' | 'plane' | 'gift' | 'cart' | 'star' | 'bolt' | 'child' | 'party' | 'car'
  | 'tag' | 'transfer' | 'income' | 'trash' | 'logout' | 'edit' | 'camera';

const paths: Record<IconName, (c: string) => React.ReactNode> = {
  back: () => <Path d="M19 12H5M12 19l-7-7 7-7" />,
  'chevron-right': () => <Path d="m9 6 6 6-6 6" />,
  'chevron-left': () => <Path d="m15 6-6 6 6 6" />,
  plus: () => <Path d="M12 5v14M5 12h14" />,
  check: () => <Path d="m5 12 5 5 9-10" />,
  close: () => <Path d="M6 6l12 12M18 6 6 18" />,
  share: () => (
    <>
      <Circle cx={18} cy={5} r={3} /><Circle cx={6} cy={12} r={3} /><Circle cx={18} cy={19} r={3} />
      <Path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  qr: () => (
    <>
      <Rect x={3} y={3} width={7} height={7} /><Rect x={14} y={3} width={7} height={7} />
      <Rect x={3} y={14} width={7} height={7} /><Path d="M14 14h3v3h-3zM17 20h4v-3M20 14v.01M14 20h.01" />
    </>
  ),
  camera: () => (
    <>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx={12} cy={13} r={3.5} />
    </>
  ),
  home: () => <Path d="M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6" />,
  heart: () => <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  plane: () => <Path d="M2 16l20-8-20-4 4 6-4 6zM6 10h8" />,
  gift: () => (
    <>
      <Rect x={3} y={8} width={18} height={13} rx={2} />
      <Path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1c2-4 6-4 6-1s-6 1-6 1" />
    </>
  ),
  cart: () => (
    <>
      <Path d="M3 4h2l2.5 11h11L21 7H6.5" /><Circle cx={9} cy={19} r={1.5} /><Circle cx={17} cy={19} r={1.5} />
    </>
  ),
  star: () => <Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  bolt: () => <Path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  child: () => (
    <>
      <Circle cx={12} cy={6} r={3} /><Path d="M8 22v-6l-2-4h12l-2 4v6M10 22v-4h4v4" />
    </>
  ),
  party: () => <Path d="M4 20 9 7l8 8zM14 4v2M19 9h2M17 6l1.5-1.5M12 2l.5 1M21 13l1 .5" />,
  car: () => (
    <>
      <Path d="M5 16V11l2-5h10l2 5v5zM3 11h18" /><Circle cx={7.5} cy={16.5} r={1.5} /><Circle cx={16.5} cy={16.5} r={1.5} />
    </>
  ),
  tag: () => (
    <>
      <Path d="M3 12V3h9l9 9-9 9z" /><Circle cx={7.5} cy={7.5} r={1.5} />
    </>
  ),
  transfer: () => <Path d="M4 8h14l-4-4M20 16H6l4 4" />,
  income: () => <Path d="M12 19V5M5 12l7-7 7 7" />,
  trash: () => <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  logout: () => <Path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />,
  edit: () => <Path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />,
};

export function Icon({
  name, size = 24, color = colors.text, strokeWidth = 2,
}: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  const draw = paths[name] ?? paths.tag;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {draw(color)}
    </Svg>
  );
}

export function Logo({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <Svg width={size} height={(size * 64) / 88} viewBox="0 0 88 64">
      <Circle cx={30} cy={32} r={26} fill="none" stroke={light ? '#FFFFFF' : colors.primary} strokeWidth={7} />
      <Circle cx={58} cy={32} r={26} fill="none" stroke={light ? '#BFDBFE' : '#93C5FD'} strokeWidth={7} />
    </Svg>
  );
}
