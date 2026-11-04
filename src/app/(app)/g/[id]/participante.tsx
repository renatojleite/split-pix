import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Avatar, Button, Card, ErrorText, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useBalances, useGroup, useRemoveMember, useRenameMember, type GroupDetail } from '@/lib/api';
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
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: space.sm }}>
        <Avatar name={name || member.display_name} color={member.color} size={72} />
        <Text style={{ fontSize: 13, color: colors.muted }}>
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
      {rename.isSuccess && !changed ? <Text style={{ fontSize: 13, color: colors.positive }}>Nome salvo ✓</Text> : null}
      <ErrorText>{rename.error?.message}</ErrorText>

      <Card style={{ gap: 6 }}>
        <Row label="Divisão padrão" value={`${formatPercent(bp)}%`} />
        <Row label="Saldo acumulado" value={balances.isLoading ? '…' : formatBRL(balance, { sign: true })}
          tone={balance > 0 ? colors.positive : balance < 0 ? colors.negative : undefined} />
      </Card>

      {!member.left_at ? (
        <View style={{ gap: space.sm, paddingTop: space.lg }}>
          <Button title={isMe ? 'Sair do grupo' : 'Remover do grupo'} variant="danger" icon={isMe ? 'logout' : 'trash'}
            onPress={confirmRemove} disabled={!!blocked || balances.isLoading} loading={remove.isPending} />
          {blocked ? <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' }}>{blocked}</Text> : null}
          <ErrorText>{remove.error?.message}</ErrorText>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 15, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: tone ?? colors.text }}>{value}</Text>
    </View>
  );
}
