import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';

import { colors } from '@/theme';

/**
 * Camada escura dos modais: cobre a tela inteira (inclusive atrás dos cantos arredondados
 * do painel) e esmaece ao aparecer. A área acima do painel fecha ao tocar.
 */
export function Backdrop({ onPress, label = 'Fechar', children, style }: {
  onPress: () => void; label?: string; children?: ReactNode; style?: object;
}) {
  return (
    <>
      <Animated.View entering={FadeIn.duration(380)} pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
      <Pressable style={[{ flex: 1 }, style]} onPress={onPress} accessibilityLabel={label}>
        {children}
      </Pressable>
    </>
  );
}

/** Painel de baixo que sobe deslizando (no máximo ~80% da tela; o conteúdo rola dentro). */
export function SlideUp({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={SlideInDown.duration(420).easing(Easing.out(Easing.cubic))}
      style={{ maxHeight: '80%', flexShrink: 1 }}>
      {children}
    </Animated.View>
  );
}
