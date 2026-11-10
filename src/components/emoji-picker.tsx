import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';
import { Icon } from './icons';
import { EmojiTile } from './ui';
import { Backdrop, SlideUp } from '@/components/backdrop';

const SECTIONS: { title: string; emojis: string[] }[] = [
  { title: 'Casa', emojis: ['🏠', '🏡', '🛋️', '🧹', '🔑', '💡', '🚿', '📺', '🛏️', '🧺'] },
  { title: 'Comida', emojis: ['🛒', '🍕', '🍔', '🍣', '☕', '🍺', '🍷', '🥗', '🍰', '🥖'] },
  { title: 'Transporte', emojis: ['🚗', '⛽', '🚌', '🚕', '🛵', '🅿️', '🚲', '🚇', '🔧', '🛞'] },
  { title: 'Lazer', emojis: ['🎉', '🎬', '🎮', '🎵', '⚽', '🏋️', '📚', '🎂', '🎁', '🎤'] },
  { title: 'Família e saúde', emojis: ['🧒', '👶', '🎒', '🐶', '🐱', '💊', '🏥', '🦷', '💇', '👕'] },
  { title: 'Contas', emojis: ['💳', '📱', '💻', '🧾', '💰', '🏦', '📦', '🏷️', '📄', '🔁'] },
  { title: 'Viagem', emojis: ['✈️', '🏨', '🗺️', '🧳', '⛰️', '🏝️', '🏖️', '📷', '🎫', '🌎'] },
  { title: 'Grupos', emojis: ['💑', '❤️', '👨‍👩‍👧', '🫶', '⭐', '🔵', '🟢', '🟣', '📅', '✅'] },
];

/** Pega o primeiro grafema (um emoji pode ter vários caracteres: 👨‍👩‍👧, 🏷️). */
function firstGrapheme(text: string): string {
  const seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (seg) for (const s of new seg(undefined, { granularity: 'grapheme' }).segment(text)) return s.segment;
  return Array.from(text).slice(0, 2).join('');
}

export function EmojiPicker({ visible, onClose, onPick, title = 'Escolha um emoji' }: {
  visible: boolean; onClose: () => void; onPick: (emoji: string) => void; title?: string;
}) {
  const [typed, setTyped] = useState('');

  function pick(e: string) {
    onPick(e);
    setTyped('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Backdrop onPress={onClose} label="Fechar" />
      <SlideUp>
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.xl, paddingBottom: space.sm }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Fechar" hitSlop={10}><Icon name="close" /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md }}
          keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <TextInput value={typed} onChangeText={setTyped} placeholder="Ou digite um emoji do teclado"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 12, fontSize: 15, color: colors.text }} />
            <Pressable disabled={!typed.trim()} onPress={() => pick(firstGrapheme(typed.trim()))}
              style={{ height: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: typed.trim() ? colors.primary : colors.card, justifyContent: 'center' }}>
              <Text style={{ color: typed.trim() ? '#FFFFFF' : colors.muted, fontWeight: '600' }}>Usar</Text>
            </Pressable>
          </View>
          {SECTIONS.map((sec) => (
            <View key={sec.title} style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.9 }}>{sec.title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {sec.emojis.map((e) => <EmojiTile key={sec.title + e} emoji={e} size={46} onPress={() => pick(e)} label={e} />)}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
      </SlideUp>
      </KeyboardAvoidingView>
    </Modal>
  );
}
