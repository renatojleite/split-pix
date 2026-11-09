import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors, space } from '@/theme';
import { Icon } from './icons';

/**
 * O app baixa atualizações sozinho ao abrir (EAS Update). Quando uma terminou de
 * baixar, este aviso deixa aplicar na hora, sem esperar fechar e abrir o app.
 */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const [reloading, setReloading] = useState(false);
  if (!Updates.isEnabled || !isUpdatePending) return null;

  return (
    <Pressable accessibilityRole="button" disabled={reloading}
      onPress={async () => { setReloading(true); await Updates.reloadAsync(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg,
        borderRadius: 18, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1,
      })}>
      <Text style={{ fontSize: 20 }}>✨</Text>
      <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
        Nova versão pronta. Toque para atualizar.
      </Text>
      {reloading ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="chevron-right" size={18} color="#FFFFFF" />}
    </Pressable>
  );
}
