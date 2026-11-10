import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button, Header, Screen } from '@/components/ui';
import { ocrSupported } from '@/lib/ocr';
import { colors, radius, space } from '@/theme';

// "Adicionar": foco na foto do comprovante com IA; galeria e PDF como atalhos; manual como secundário.
export default function NovoLancamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ai = (source?: 'camera' | 'gallery' | 'file') =>
    router.replace({ pathname: '/comprovante', params: { groupId: id, ...(source ? { source } : {}) } });
  const manual = () => router.replace({ pathname: '/g/[id]/item', params: { id } });

  return (
    <Screen>
      <Header title="Novo lançamento" />

      <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xl, paddingBottom: space.sm }}>
        <View style={{ width: 124, height: 124, borderRadius: 62, backgroundColor: '#F7F9FF', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: '#EFF4FF', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 44 }}>📷</Text>
          </View>
        </View>
        <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginTop: space.sm }}>✨ Leia o comprovante com IA</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' }}>
          Valor, data e destinatário{'\n'}preenchidos automaticamente.
        </Text>
      </View>

      {ocrSupported ? (
        <>
          <Button title="Tirar foto do comprovante" onPress={() => ai('camera')} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xxl }}>
            <Pressable onPress={() => ai('gallery')} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>🖼️ Galeria</Text>
            </Pressable>
            <Pressable onPress={() => ai('file')} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>📄 PDF</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Button title="Colar texto do comprovante" onPress={() => ai()} />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.xs }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        <Text style={{ fontSize: 12, color: colors.muted }}>ou</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      </View>

      <Pressable onPress={manual} accessibilityRole="button"
        style={({ pressed }) => ({ height: 54, borderRadius: radius.input, borderWidth: 1, borderColor: colors.divider,
          alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.card : colors.surface })}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSoft }}>✍️ Cadastrar manualmente</Text>
      </Pressable>
    </Screen>
  );
}
