import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions, type HostInstance } from 'react-native';

import { colors, space } from '@/theme';
import { Icon } from './icons';

export type Anchor = { x: number; y: number; width: number; height: number };
export type MenuItem = { emoji: string; label: string; onPress: () => void; destructive?: boolean; confirm?: string };

const WIDTH = 210;
const ROW = 44;

/**
 * Menu flutuante pequeno, colado ao botão que o abriu (não é o diálogo do Android).
 * Toque fora fecha. Itens com `confirm` pedem confirmação ali mesmo, no próprio menu.
 */
export function PopoverMenu({ anchor, items, onClose }: { anchor: Anchor | null; items: MenuItem[]; onClose: () => void }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [confirming, setConfirming] = useState<MenuItem | null>(null);
  if (!anchor) return null;

  const rows = confirming ? 3 : items.length;
  const height = rows * ROW + space.sm * 2;
  const left = Math.min(Math.max(anchor.x + anchor.width - WIDTH, space.md), screenW - WIDTH - space.md);
  const below = anchor.y + anchor.height + 4;
  const top = below + height > screenH - 24 ? Math.max(anchor.y - height - 4, 24) : below;
  const close = () => { setConfirming(null); onClose(); };
  const run = (item: MenuItem) => {
    if (item.confirm && !confirming) { setConfirming(item); return; }
    close();
    item.onPress();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Fechar menu">
        <View onStartShouldSetResponder={() => true}
          style={{ position: 'absolute', left, top, width: WIDTH, paddingVertical: space.sm, borderRadius: 14,
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider,
            shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
          {confirming ? (
            <>
              <Text style={{ height: ROW, textAlignVertical: 'center', paddingHorizontal: space.lg, fontSize: 13, fontWeight: '700', color: colors.text }}
                numberOfLines={1}>{confirming.confirm}</Text>
              <Row emoji="🗑️" label="Sim, excluir" destructive onPress={() => run(confirming)} />
              <Row emoji="↩️" label="Cancelar" onPress={() => setConfirming(null)} />
            </>
          ) : items.map((it) => <Row key={it.label} {...it} onPress={() => run(it)} />)}
        </View>
      </Pressable>
    </Modal>
  );
}

function Row({ emoji, label, onPress, destructive }: { emoji: string; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem"
      style={({ pressed }) => ({ height: ROW, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg,
        backgroundColor: pressed ? colors.card : 'transparent' })}>
      <Text style={{ fontSize: 15 }}>{emoji}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: destructive ? colors.negative : colors.text }}>{label}</Text>
    </Pressable>
  );
}

/** Botão ⋮ que mede a própria posição e avisa onde abrir o menu. */
export function MoreButton({ onOpen, label = 'Mais ações' }: { onOpen: (a: Anchor) => void; label?: string }) {
  const ref = useRef<HostInstance>(null);
  return (
    <Pressable ref={ref} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}
      onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen({ x, y, width, height }))}
      style={({ pressed }) => ({ width: 28, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
        backgroundColor: pressed ? colors.divider : 'transparent' })}>
      <Icon name="more" size={18} color={colors.muted} />
    </Pressable>
  );
}
