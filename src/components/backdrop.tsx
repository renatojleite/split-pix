import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { colors } from '@/theme';

/** Camada escura dos modais: esmaece ao aparecer (o painel sobe por cima). */
export function Backdrop({ onPress, label = 'Fechar', children, style }: {
  onPress: () => void; label?: string; children?: ReactNode; style?: object;
}) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
      <Pressable style={[{ flex: 1, backgroundColor: colors.scrim }, style]} onPress={onPress} accessibilityLabel={label}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Painel de baixo que sobe deslizando (no máximo ~80% da tela; o conteúdo rola dentro). */
export function SlideUp({ children }: { children: ReactNode }) {
  return <Animated.View entering={SlideInDown.duration(260)} style={{ maxHeight: '80%', flexShrink: 1 }}>{children}</Animated.View>;
}
