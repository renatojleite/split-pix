import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Avatar, Button, Card, Chip, ErrorText, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useBalances, useGroup, useRemoveMember, useRenameMember, useSetMemberPix, type GroupDetail } from '@/lib/api';
import { normalizePixKey, PIX_KEY_TYPES, type PixKeyType } from '@/lib/pix';
import { useUserId } from '@/lib/auth';
import { formatBRL, formatPercent } from '@/lib/money';
import { effectiveRule } from '@/lib/split';
import { today } from '@/lib/dates';
import type { Member } from '@/lib/types';
import { colors, space } from '@/theme';

export default function ParticipanteScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const group = useGroup(id);
  const member = group.data?.allMembers.find((m) => m.id === memberId);
  if (!group.data) return <Screen><Header title="Participante" /><Loading /></Screen>;
  if (!member) return <Screen><Header title="Participante" /><Text style={{ color: colors.muted }}>Participante não encontrado.</Text></Screen>;
  return <MemberForm detail={group.data} member={member} />;
}

function MemberForm({ detail, member }: { detail: GroupDetail; member: Member }) {
  const userId = useUserId();
  const rename = useRenameMember(detail.group.id);
  const remove = useRemoveMember(detail.group.id);
  const balances = useBalances(detail.group.id);
  const [name, setName] = useState(member.display_name);

  const isMe = member.user_id === userId;
  const iAmOwner = detail.members.some((m) => m.user_id === userId && m.role === 'owner');
  const balance = (balances.data ?? []).filter((b) => b.member_id === member.id).reduce((a, b) => a + b.balance_cents, 0);
  const rule = effectiveRule(detail.rules, null, today());
  const bp = rule?.shares.find((s) => s.member_id === member.id)?.basis_points ?? 0;
  const changed = !!name.trim() && name.trim() !== member.display_name;

  // Mesmas regras do banco (remove_member), para explicar antes de tentar.
  const blocked =
    member.left_at ? 'Esta pessoa já saiu do grupo.'
    : member.role === 'owner' ? 'Quem criou o grupo não pode ser removido.'
    : member.user_id && !isMe && !iAmOwner ? 'Só quem criou o grupo pode remover quem já usa o app.'
    : balance !== 0 ? `Saldo de ${formatBRL(balance, { sign: true })}. Registrem o acerto na aba Saldos antes de remover.`
    : detail.members.length <= 1 ? 'O grupo precisa de pelo menos uma pessoa.'
    : null;

  function confirmRemove() {
    const others = detail.members.filter((m) => m.id !== member.id).map((m) => m.display_name).join(', ');
    Alert.alert(
      isMe ? 'Sair do grupo?' : `Remover ${member.display_name}?`,
      [
        isMe ? 'Você deixa de ver este grupo.' : `${member.display_name} sai do grupo e das próximas divisões.`,
        'Lançamentos antigos continuam com o nome e os saldos não mudam.',
        bp > 0 ? `O ${formatPercent(bp)}% da divisão é repartido proporcionalmente entre ${others}.` : '',
      ].filter(Boolean).join('\n\n'),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isMe ? 'Sair' : 'Remover', style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync(member.id);
            if (isMe) router.dismissTo('/');
            else router.back();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Header title={isMe ? 'Você no grupo' : 'Participante'} />
      <View style={{ alignItems: 'center', gap: 7, paddingVertical: space.sm }}>
        <Avatar name={name || member.display_name} color={member.color} size={64} />
        <Text style={{ fontSize: 12, color: colors.muted }}>
          {member.left_at ? 'saiu do grupo' : isMe ? 'você' : member.user_id ? (member.role === 'owner' ? 'criou o grupo' : 'usa o app') : 'ainda sem conta no app'}
        </Text>
      </View>

      <Field label="Nome no grupo" hint="Aparece para todos nos lançamentos, saldos e no histórico.">
        <Input value={name} onChangeText={setName} maxLength={40} placeholder="Nome" editable={!member.left_at} />
      </Field>
      {changed ? (
        <Button title="Salvar nome" loading={rename.isPending}
          onPress={async () => { await rename.mutateAsync({ memberId: member.id, name }); }} />
      ) : null}
      {rename.isSuccess && !changed ? <Text style={{ fontSize: 12, color: colors.positive }}>Nome salvo ✓</Text> : null}
      <ErrorText>{rename.error?.message}</ErrorText>

      <Card style={{ gap: 6 }}>
        <Row label="Divisão padrão" value={`${formatPercent(bp)}%`} />
        <Row label="Saldo acumulado" value={balances.isLoading ? '…' : formatBRL(balance, { sign: true })}
          tone={balance > 0 ? colors.positive : balance < 0 ? colors.negative : undefined} />
      </Card>

      {!member.left_at ? <PixKeySection groupId={detail.group.id} member={member} canEdit={isMe || !member.user_id} isMe={isMe} /> : null}

      {!member.left_at ? (
        <View style={{ gap: space.sm, paddingTop: space.lg }}>
          <Button title={isMe ? 'Sair do grupo' : 'Remover do grupo'} variant="danger" icon={isMe ? 'logout' : 'trash'}
            onPress={confirmRemove} disabled={!!blocked || balances.isLoading} loading={remove.isPending} />
          {blocked ? <Text style={{ fontSize: 12, lineHeight: 15, color: colors.muted, textAlign: 'center' }}>{blocked}</Text> : null}
          <ErrorText>{remove.error?.message}</ErrorText>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: tone ?? colors.text }}>{value}</Text>
    </View>
  );
}

/** Chave Pix guardada no grupo (aparece no relatório e no Pix). Cada um cuida da sua; de quem não tem conta, qualquer membro. */
function PixKeySection({ groupId, member, canEdit, isMe }: { groupId: string; member: Member; canEdit: boolean; isMe: boolean }) {
  const setPix = useSetMemberPix(groupId);
  const [editing, setEditing] = useState(false);
  const [keyType, setKeyType] = useState<PixKeyType>(member.pix_key_type ?? 'phone');
  const [key, setKey] = useState(member.pix_key ?? '');
  const [name, setName] = useState(member.pix_name ?? member.display_name);

  let keyError: string | null = null;
  let normalized = '';
  try {
    if (key.trim()) normalized = normalizePixKey(keyType, key);
  } catch (e) {
    keyError = e instanceof Error ? e.message : 'Chave inválida';
  }
  const info = PIX_KEY_TYPES.find((t) => t.value === keyType)!;
  const has = !!member.pix_key;
  const label = PIX_KEY_TYPES.find((t) => t.value === member.pix_key_type)?.label;

  async function save() {
    await setPix.mutateAsync({ memberId: member.id, profile: { keyType, key: normalized, name: name.trim(), city: member.pix_city ?? '' } });
    setEditing(false);
  }

  if (!editing) {
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Chave Pix{has ? ` (${label})` : ''}</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: has ? colors.text : colors.muted }} numberOfLines={1}>
            {has ? member.pix_key : '(ausente)'}
          </Text>
          {has && member.pix_name ? <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>{member.pix_name}</Text> : null}
          {!canEdit && !has ? (
            <Text style={{ fontSize: 12, color: colors.muted }}>Só {member.display_name} cadastra a própria chave, no app.</Text>
          ) : null}
        </View>
        {canEdit ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{has ? 'Alterar' : 'Cadastrar'}</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.md }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{isMe ? 'Sua chave Pix' : `Chave Pix de ${member.display_name}`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {PIX_KEY_TYPES.map((t) => <Chip key={t.value} label={t.label} selected={keyType === t.value} onPress={() => setKeyType(t.value)} />)}
      </View>
      <Input value={key} onChangeText={setKey} placeholder={info.placeholder} keyboardType={info.keyboard}
        autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: colors.surface }} />
      {key.trim() && keyError ? <ErrorText>{keyError}</ErrorText> : null}
      <Input value={name} onChangeText={setName} placeholder="Nome de quem recebe" maxLength={40} style={{ backgroundColor: colors.surface }} />
      <Text style={{ fontSize: 12, lineHeight: 15, color: colors.muted }}>
        Fica salva no grupo, visível só para os membros. Entra no relatório e no Pix de acerto.
      </Text>
      <ErrorText>{setPix.error?.message}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <Button title="Cancelar" variant="secondary" style={{ flex: 1, height: 42 }} onPress={() => setEditing(false)} />
        <Button title="Salvar" style={{ flex: 1, height: 42 }} onPress={save} loading={setPix.isPending}
          disabled={!normalized || !name.trim()} />
      </View>
      {has ? (
        <Button title="Remover chave" variant="ghost" loading={setPix.isPending}
          onPress={async () => { await setPix.mutateAsync({ memberId: member.id, profile: null }); setKey(''); setEditing(false); }} />
      ) : null}
    </Card>
  );
}
