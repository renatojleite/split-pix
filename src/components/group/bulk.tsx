import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGroups } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import type { Category } from '@/lib/types';
import { colors, space } from '@/theme';
import { Chip, EmojiTile } from '../ui';

/** Folha que sobe de baixo, com título e conteúdo livre. */
function Sheet({ visible, onClose, title, subtitle, children }: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={{ maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingTop: space.sm, paddingBottom: insets.bottom + space.lg, gap: space.md }}>
        <View style={{ alignSelf: 'center', width: 35, height: 3, borderRadius: 2, backgroundColor: colors.divider }} />
        <View style={{ paddingHorizontal: space.xl, gap: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>{subtitle}</Text> : null}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function Option({ emoji, title, hint, onPress }: { emoji: string; title: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 14,
        borderWidth: 1, borderColor: colors.divider, backgroundColor: pressed ? colors.card : colors.surface })}>
      <EmojiTile emoji={emoji} size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{title}</Text>
        {hint ? <Text style={{ fontSize: 12, lineHeight: 16, color: colors.muted }}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Onde duplicar: neste grupo ou em outro grupo do usuário. */
export function DuplicateSheet({ visible, onClose, groupId, count, onPick }: {
  visible: boolean; onClose: () => void; groupId: string; count: number;
  onPick: (targetGroupId: string) => void;
}) {
  const groups = useGroups(useUserId());
  const current = groups.data?.find((g) => g.id === groupId);
  const others = (groups.data ?? []).filter((g) => g.id !== groupId && !g.archived_at);
  const what = count === 1 ? 'o lançamento' : `os ${count} lançamentos`;
  return (
    <Sheet visible={visible} onClose={onClose} title="Duplicar em qual grupo?" subtitle={`Copia ${what} com a mesma data e valor.`}>
      {current ? (
        <Option emoji={current.emoji} title={`Neste grupo · ${current.name}`} hint="Cópia igual, com a mesma divisão."
          onPress={() => onPick(groupId)} />
      ) : null}
      {others.length ? (
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, paddingTop: space.sm }}>EM OUTRO GRUPO</Text>
      ) : null}
      {others.map((g) => (
        <Option key={g.id} emoji={g.emoji} title={g.name}
          hint="Quem pagou e categoria pelo nome; divisão padrão desse grupo." onPress={() => onPick(g.id)} />
      ))}
      {groups.data && !others.length ? (
        <Text style={{ fontSize: 12, color: colors.muted }}>Você não tem outros grupos ativos.</Text>
      ) : null}
    </Sheet>
  );
}

/** Nova categoria para os selecionados. */
export function CategorySheet({ visible, onClose, categories, count, onPick }: {
  visible: boolean; onClose: () => void; categories: Category[]; count: number; onPick: (categoryId: string | null) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Mudar categoria"
      subtitle={`${count} ${count === 1 ? 'lançamento' : 'lançamentos'}. Quem usa a divisão padrão passa a seguir a regra da nova categoria.`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {categories.map((c) => <Chip key={c.id} label={`${c.emoji} ${c.name}`} onPress={() => onPick(c.id)} />)}
        <Chip label="Sem categoria" onPress={() => onPick(null)} />
      </View>
    </Sheet>
  );
}

/** Confirmação curta para excluir os selecionados. */
export function ConfirmSheet({ visible, onClose, title, subtitle, action, onConfirm }: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; action: string; onConfirm: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <Pressable onPress={onConfirm} accessibilityRole="button"
        style={({ pressed }) => ({ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: pressed ? '#B91C1C' : colors.negative })}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>{action}</Text>
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSoft }}>Cancelar</Text>
      </Pressable>
    </Sheet>
  );
}

/** Barra de ações da seleção (fica no rodapé, no lugar do botão Adicionar). */
export function SelectionBar({ count, total, onAll, onCategory, onDuplicate, onDelete, onCancel, bottom }: {
  count: number; total: number; onAll: () => void; onCategory: () => void; onDuplicate: () => void; onDelete: () => void;
  onCancel: () => void; bottom: number;
}) {
  const off = count === 0;
  return (
    <View style={{ position: 'absolute', left: space.md, right: space.md, bottom, padding: space.sm, gap: space.sm, borderRadius: 18,
      backgroundColor: colors.inverse, elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm }}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
          {count} {count === 1 ? 'selecionado' : 'selecionados'}
        </Text>
        <Pressable onPress={onAll} hitSlop={8} style={{ paddingHorizontal: space.sm }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#93C5FD' }}>{count === total ? 'Limpar' : 'Todos'}</Text>
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Sair da seleção" style={{ paddingLeft: space.sm }}>
          <Text style={{ fontSize: 16, color: '#FFFFFF' }}>✕</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <BarButton emoji="🏷️" label="Categoria" onPress={onCategory} disabled={off} />
        <BarButton emoji="📋" label="Duplicar" onPress={onDuplicate} disabled={off} />
        <BarButton emoji="🗑️" label="Excluir" onPress={onDelete} disabled={off} danger />
      </View>
    </View>
  );
}

function BarButton({ emoji, label, onPress, disabled, danger }: { emoji: string; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.sm, borderRadius: 12,
        backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', opacity: disabled ? 0.4 : 1 })}>
      <Text style={{ fontSize: 17 }}>{emoji}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: danger ? '#FCA5A5' : '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}
