import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { useAddCategory, useAddMember, useUpdateGroup, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { monthLabel, today } from '@/lib/dates';
import { formatPercent } from '@/lib/money';
import { effectiveRule } from '@/lib/split';
import type { Rule } from '@/lib/types';
import { colors, space } from '@/theme';
import { Icon } from '../icons';
import { EmojiPicker } from '../emoji-picker';
import { Avatar, Button, Card, EmojiTile, Input, SectionTitle, SplitBar } from '../ui';

export function SplitTab({ detail }: { detail: GroupDetail }) {
  const userId = useUserId();
  const { group, members, categories, rules } = detail;
  const now = today();
  const defaultRule = effectiveRule(rules, null, now);
  const isOwner = members.some((m) => m.user_id === userId && m.role === 'owner');
  const addMember = useAddMember(group.id);
  const addCategory = useAddCategory(group.id);
  const update = useUpdateGroup(group.id);
  const [newMember, setNewMember] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newEmoji, setNewEmoji] = useState('🏷️');
  const [picking, setPicking] = useState(false);

  const bp = (rule: Rule | null, memberId: string) => rule?.shares.find((s) => s.member_id === memberId)?.basis_points ?? 0;
  const label = (rule: Rule | null) =>
    members.filter((m) => bp(rule, m.id) > 0).map((m) => formatPercent(bp(rule, m.id))).join('/');

  const openRule = (categoryId?: string) =>
    router.push({ pathname: '/g/[id]/regra', params: { id: group.id, ...(categoryId ? { categoryId } : {}) } });

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 48, gap: space.md, paddingTop: space.md }}>
      <Card style={{ gap: 10 }} onPress={() => openRule()}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Padrão do grupo</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Alterar</Text>
        </View>
        <SplitBar parts={members.map((m) => ({ color: m.color, bp: bp(defaultRule, m.id) }))} height={14} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          {members.map((m) => (
            <Text key={m.id} style={{ fontSize: 15, color: colors.text }}>
              {m.display_name} <Text style={{ fontWeight: '700' }}>{formatPercent(bp(defaultRule, m.id))}%</Text>
            </Text>
          ))}
        </View>
        {defaultRule && defaultRule.effective_from > '1900-01-01' ? (
          <Text style={{ fontSize: 13, color: colors.muted }}>Vigente desde {monthLabel(defaultRule.effective_from).toLowerCase()}</Text>
        ) : null}
      </Card>

      <SectionTitle>Por categoria</SectionTitle>
      <Card style={{ padding: 0 }}>
        {categories.map((c, i) => {
          const own = rules.some((r) => r.category_id === c.id);
          const rule = effectiveRule(rules, c.id, now);
          return (
            <Pressable key={c.id} onPress={() => openRule(c.id)} accessibilityRole="button"
              style={{ paddingHorizontal: space.lg, paddingVertical: 12, gap: 6,
                borderBottomWidth: i === categories.length - 1 ? 0 : 1, borderColor: colors.divider }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <EmojiTile emoji={c.emoji} size={28} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{c.name}</Text>
                <Text style={{ fontSize: 15, color: own ? colors.text : colors.muted }}>
                  {own ? label(rule) : `padrão ${label(defaultRule)}`}
                </Text>
              </View>
              <View style={{ opacity: own ? 1 : 0.35, paddingLeft: 38 }}>
                <SplitBar parts={members.map((m) => ({ color: m.color, bp: bp(rule, m.id) }))} height={6} />
              </View>
            </Pressable>
          );
        })}
      </Card>
      {newCategory === null ? (
        <Pressable onPress={() => setNewCategory('')} hitSlop={8}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>+ Nova categoria</Text>
        </Pressable>
      ) : (
        <InlineAdd value={newCategory} onChange={setNewCategory} placeholder="Nome da categoria" loading={addCategory.isPending}
          emoji={newEmoji} onEmoji={() => setPicking(true)}
          onSave={async () => { await addCategory.mutateAsync({ name: newCategory, emoji: newEmoji }); setNewCategory(null); setNewEmoji('🏷️'); }}
          onCancel={() => setNewCategory(null)} />
      )}

      <SectionTitle>Participantes</SectionTitle>
      <Card style={{ padding: 0 }}>
        {members.map((m, i) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, height: 60,
            borderBottomWidth: i === members.length - 1 ? 0 : 1, borderColor: colors.divider }}>
            <Avatar name={m.display_name} color={m.color} size={36} />
            <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{m.display_name}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {m.user_id === userId ? 'você' : m.user_id ? (m.role === 'owner' ? 'criou o grupo' : 'no app') : 'ainda sem conta'}
            </Text>
          </View>
        ))}
      </Card>
      {newMember === null ? (
        <Pressable onPress={() => setNewMember('')} hitSlop={8}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>+ Adicionar participante</Text>
        </Pressable>
      ) : (
        <InlineAdd value={newMember} onChange={setNewMember} placeholder="Nome" loading={addMember.isPending}
          hint="Entra com 0% — ajuste o padrão depois."
          onSave={async () => { await addMember.mutateAsync(newMember); setNewMember(null); }}
          onCancel={() => setNewMember(null)} />
      )}

      <Card style={{ backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        onPress={() => router.push({ pathname: '/g/[id]/convite', params: { id: group.id } })}>
        <Icon name="qr" size={32} color={colors.primaryInk} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.primaryInk }}>Código de convite</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: 3, color: colors.text }}>{group.invite_code}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.primaryInk} />
      </Card>

      <EmojiPicker visible={picking} onClose={() => setPicking(false)} onPick={setNewEmoji} title="Emoji da categoria" />

      <Button variant="secondary" icon="copy" title="Duplicar grupo"
        onPress={() => router.push({ pathname: '/g/[id]/duplicar', params: { id: group.id } })} />

      {isOwner ? (
        <Button variant="ghost" title={group.archived_at ? 'Desarquivar grupo' : 'Arquivar grupo'}
          onPress={() => Alert.alert(
            group.archived_at ? 'Desarquivar grupo?' : 'Arquivar grupo?',
            group.archived_at ? undefined : 'Ele sai da lista principal e o código de convite para de funcionar. Nada é apagado.',
            [{ text: 'Cancelar', style: 'cancel' },
             { text: 'Confirmar', onPress: () => update.mutate({ archived_at: group.archived_at ? null : new Date().toISOString() }) }],
          )} />
      ) : null}
    </ScrollView>
  );
}

function InlineAdd({ value, onChange, onSave, onCancel, placeholder, loading, hint, emoji, onEmoji }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
  placeholder: string; loading: boolean; hint?: string; emoji?: string; onEmoji?: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {emoji && onEmoji ? <EmojiTile emoji={emoji} size={56} onPress={onEmoji} /> : null}
        <Input value={value} onChangeText={onChange} placeholder={placeholder} autoFocus maxLength={40} style={{ flex: 1 }} />
      </View>
      {hint ? <Text style={{ fontSize: 13, color: colors.muted }}>{hint}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Cancelar" variant="secondary" style={{ flex: 1, height: 48 }} onPress={onCancel} />
        <Button title="Adicionar" style={{ flex: 1, height: 48 }} onPress={onSave} disabled={!value.trim()} loading={loading} />
      </View>
    </View>
  );
}
