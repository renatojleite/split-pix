import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

export type SheetAction = { label: string; hint?: string; emoji?: string; onPress: () => void; destructive?: boolean };

/** Menu que sobe de baixo (o Alert do Android só aceita 3 botões e sem descrição). */
export function ActionSheet({ visible, onClose, title, actions }: {
  visible: boolean; onClose: () => void; title?: string; actions: SheetAction[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Fechar menu" />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingTop: space.sm, paddingBottom: insets.bottom + space.lg }}>
        <View style={{ alignSelf: 'center', width: 35, height: 3, borderRadius: 2, backgroundColor: colors.divider, marginBottom: space.sm }} />
        {title ? <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, paddingHorizontal: space.xl, paddingVertical: space.sm }}>{title}</Text> : null}
        {actions.map((a) => (
          <Pressable key={a.label} accessibilityRole="menuitem" onPress={() => { onClose(); a.onPress(); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 53,
              paddingHorizontal: space.xl, paddingVertical: space.md, backgroundColor: pressed ? colors.card : 'transparent' })}>
            {a.emoji ? <Text style={{ fontSize: 21, width: 29, textAlign: 'center' }}>{a.emoji}</Text> : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: a.destructive ? colors.negative : colors.text }}>{a.label}</Text>
              {a.hint ? <Text style={{ fontSize: 12, color: colors.muted }}>{a.hint}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
