import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Header, Screen } from '@/components/ui';
import { ocrSupported } from '@/lib/ocr';
import { colors, radius, space } from '@/theme';

// "Adicionar": cadastro normal ou comprovante + IA (que já abre direto na fonte escolhida).
export default function NovoLancamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ai = (source?: 'camera' | 'gallery' | 'file') =>
    router.replace({ pathname: '/comprovante', params: { groupId: id, ...(source ? { source } : {}) } });

  return (
    <Screen>
      <Header title="Novo lançamento" />
      <Text style={{ fontSize: 15, color: colors.textSoft }}>Como você quer cadastrar?</Text>

      <View style={{ backgroundColor: colors.primaryInk, borderRadius: radius.card, padding: space.xl, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Text style={{ fontSize: 33 }}>✨</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: '#FFFFFF' }}>Comprovante + IA</Text>
              <View style={{ backgroundColor: '#22C55E', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>MAIS RÁPIDO</Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' }}>
              A IA lê o comprovante no seu celular e preenche valor, data e destinatário.
            </Text>
          </View>
        </View>
        {ocrSupported ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Quick emoji="📷" label="Foto" onPress={() => ai('camera')} />
            <Quick emoji="🖼️" label="Galeria" onPress={() => ai('gallery')} />
            <Quick emoji="📄" label="PDF" onPress={() => ai('file')} />
          </View>
        ) : (
          <Quick emoji="📋" label="Colar texto do comprovante" onPress={() => ai()} />
        )}
      </View>

      <Pressable onPress={() => router.replace({ pathname: '/g/[id]/item', params: { id } })} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.xl,
          borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ fontSize: 33 }}>✍️</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 19, fontWeight: '700', color: colors.text }}>Cadastro normal</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>Digite valor, quem pagou, categoria e divisão.</Text>
        </View>
        <Text style={{ fontSize: 22, color: colors.muted }}>›</Text>
      </Pressable>
    </Screen>
  );
}

function Quick({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: space.md, borderRadius: radius.input,
        backgroundColor: pressed ? '#1D4ED8' : colors.primary })}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}
