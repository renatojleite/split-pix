import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddComment, useRemoveComment } from '@/lib/api';
import type { EntryComment, Member } from '@/lib/types';
import { colors, space } from '@/theme';
import { Backdrop, SlideUp } from '@/components/backdrop';

// Comentários dos lançamentos, em amarelo pastel (post-it).

const pad = (n: number) => String(n).padStart(2, '0');
export function commentDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Selo 💬 com a quantidade, sobre o item. */
export function CommentBadge({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${count} ${count === 1 ? 'comentário' : 'comentários'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: 11, backgroundColor: pressed ? colors.noteBorder : colors.note, borderWidth: 1, borderColor: colors.noteBorder })}>
      <Text style={{ fontSize: 12 }}>💬</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.noteInk }}>{count}</Text>
    </Pressable>
  );
}

/** Um comentário: texto, quem fez e quando. */
export function CommentNote({ c, author, onRemove }: { c: EntryComment; author: string; onRemove?: () => void }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, lineHeight: 19, color: colors.noteInk }}>{c.body}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ flex: 1, fontSize: 10, color: colors.noteInk, opacity: 0.6 }}>
          <Text style={{ fontWeight: '700' }}>{author}</Text> · {commentDate(c.created_at)}
        </Text>
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Apagar comentário">
            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.noteInk, opacity: 0.6 }}>Apagar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Caixa amarela abaixo do item (quando "Mostrar comentários" está ligado). */
export function CommentBox({ comments, members, onPress }: { comments: EntryComment[]; members: Member[]; onPress: () => void }) {
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? '—';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Abrir comentários"
      style={{ marginTop: -2, marginLeft: space.xl, gap: space.sm, padding: space.md, borderRadius: 14,
        backgroundColor: colors.note, borderWidth: 1, borderColor: colors.noteBorder, borderTopLeftRadius: 3 }}>
      {comments.map((c, i) => (
        <View key={c.id} style={{ paddingTop: i ? space.sm : 0, borderTopWidth: i ? 1 : 0, borderColor: colors.noteBorder }}>
          <CommentNote c={c} author={name(c.author_member_id)} />
        </View>
      ))}
    </Pressable>
  );
}

/** Folha com todos os comentários do item, campo para escrever e apagar os próprios. */
export function CommentsModal({ visible, onClose, groupId, entryId, title, comments, members, myMemberId }: {
  visible: boolean; onClose: () => void; groupId: string; entryId: string | null; title: string;
  comments: EntryComment[]; members: Member[]; myMemberId: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const add = useAddComment(groupId);
  const remove = useRemoveComment(groupId);
  const [text, setText] = useState('');
  const name = (id: string) => {
    const m = members.find((x) => x.id === id);
    return id === myMemberId ? 'Você' : m?.display_name ?? '—';
  };

  async function send() {
    if (!entryId || !text.trim()) return;
    await add.mutateAsync({ entryId, body: text });
    setText('');
  }

  function confirmRemove(c: EntryComment) {
    Alert.alert('Apagar comentário?', c.body.slice(0, 120), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => remove.mutate(c.id) },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Backdrop onPress={onClose} label="Fechar" />
        <SlideUp>
        <View style={{ flexShrink: 1, backgroundColor: colors.note, borderTopLeftRadius: 26, borderTopRightRadius: 26,
          paddingTop: space.sm, paddingBottom: insets.bottom + space.lg, gap: space.md }}>
          <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.noteBorder }} />
          <View style={{ paddingHorizontal: space.xl, gap: 2 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.1, color: colors.noteInk, opacity: 0.7 }}>💬 COMENTÁRIOS</Text>
            <Text style={{ fontSize: 19, fontWeight: '700', color: colors.noteInk }} numberOfLines={1}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }} keyboardShouldPersistTaps="handled">
            {comments.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.noteInk, opacity: 0.7 }}>Nenhum comentário ainda. Escreva o primeiro.</Text>
            ) : comments.map((c) => (
              <View key={c.id} style={{ backgroundColor: '#FFFDF0', borderRadius: 14, padding: space.md, borderWidth: 1, borderColor: colors.noteBorder }}>
                <CommentNote c={c} author={name(c.author_member_id)}
                  onRemove={c.author_member_id === myMemberId ? () => confirmRemove(c) : undefined} />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.xl }}>
            <TextInput value={text} onChangeText={setText} placeholder="Escreva um comentário…" placeholderTextColor="#A16207"
              multiline maxLength={500}
              style={{ flex: 1, minHeight: 46, maxHeight: 110, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1,
                borderColor: colors.noteBorder, paddingHorizontal: space.md, paddingVertical: 11, fontSize: 15, color: colors.text }} />
            <Pressable onPress={send} disabled={!text.trim() || add.isPending} accessibilityRole="button" accessibilityLabel="Enviar comentário"
              style={({ pressed }) => ({ height: 46, paddingHorizontal: space.lg, borderRadius: 14, justifyContent: 'center',
                backgroundColor: !text.trim() ? colors.noteBorder : pressed ? '#EAB308' : colors.noteStrong })}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.noteInk }}>{add.isPending ? '…' : 'Enviar'}</Text>
            </Pressable>
          </View>
          {add.error ? <Text style={{ fontSize: 13, color: colors.negative, paddingHorizontal: space.xl }}>{add.error.message}</Text> : null}
        </View>
        </SlideUp>
      </KeyboardAvoidingView>
    </Modal>
  );
}
