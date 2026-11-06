import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

const STEPS = [
  'Lendo o comprovante com IA no seu celular',
  'Encontrando valor, data e destinatário',
  'Descartando CPF, chaves e códigos',
  'Preenchendo o lançamento',
];

export const AI_MIN_MS = 2600; // tempo mínimo da tela, para dar para ler os passos

/** Tela cheia mostrando a leitura inteligente; os passos vão se completando. */
export function AiAnalysis({ visible, done }: { visible: boolean; done: boolean }) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent>
      {visible ? <Content done={done} /> : null}
    </Modal>
  );
}

function Content({ done }: { done: boolean }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const pulse = useSharedValue(1);
  const spin = useSharedValue(0);

  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
    spin.set(withRepeat(withTiming(360, { duration: 2400, easing: Easing.linear }), -1));
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), AI_MIN_MS / STEPS.length);
    return () => clearInterval(t);
  }, [pulse, spin]);

  const shown = done ? STEPS.length : step;
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.primaryInk, paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40,
      paddingHorizontal: space.xxl, alignItems: 'center', gap: space.xxl }}>
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 3,
          borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#93C5FD', borderRightColor: '#C4B5FD' }, ring]} />
        <Animated.View style={[{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary,
          alignItems: 'center', justifyContent: 'center', shadowColor: '#93C5FD', shadowOpacity: 0.8, shadowRadius: 24, elevation: 12 }, orb]}>
          <Text style={{ fontSize: 44 }}>{done ? '✅' : '✨'}</Text>
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#93C5FD' }}>LEITURA INTELIGENTE</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }}>
          {done ? 'Pronto! Confira os dados' : 'Analisando seu comprovante'}
        </Text>
      </View>

      <View style={{ alignSelf: 'stretch', gap: space.md, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 19, padding: space.xl }}>
        {STEPS.map((label, i) => {
          const ok = i < shown;
          const current = i === shown && !done;
          return (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: ok || current ? 1 : 0.4 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                backgroundColor: ok ? '#22C55E' : 'rgba(255,255,255,0.15)' }}>
                <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '800' }}>{ok ? '✓' : current ? '…' : ''}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: current ? '700' : '500' }}>{label}</Text>
            </View>
          );
        })}
      </View>

      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 18 }}>
        🔒 Tudo acontece no seu aparelho. A imagem é apagada logo após a leitura.
      </Text>
    </View>
  );
}
