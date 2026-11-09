import { useLocalSearchParams } from 'expo-router';
import { Alert, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, ErrorText, Header, Loading, Screen } from '@/components/ui';
import { useGroup, useRegenerateInvite } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { APK_DOWNLOAD_URL } from '@/lib/config';
import { colors, space } from '@/theme';

const inviteLink = (code: string) => `splitpix://convite/${code}`;

/** Texto para WhatsApp/SMS: o link https vira clicável; o código serve para quem já tem o app. */
function inviteMessage(groupName: string, emoji: string, code: string) {
  return [
    `Oi! Vamos organizar as contas do grupo "${groupName}" ${emoji} no split-pix.`,
    '',
    `1. Baixe o app (Android): ${APK_DOWNLOAD_URL}`,
    '2. Abra, entre com seu e-mail e toque em Participar',
    `3. Digite o código: *${code}*`,
    '',
    'Se o Android avisar, permita "instalar apps desta fonte".',
  ].join('\n');
}

export default function ConviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const group = useGroup(id);
  const regenerate = useRegenerateInvite(id);

  if (!group.data) return <Screen><Loading /></Screen>;
  const { group: g, members } = group.data;
  const isOwner = members.some((m) => m.user_id === userId && m.role === 'owner');

  return (
    <Screen footer={<>
      <Button title="Compartilhar convite" icon="share" onPress={() => Share.share({
        message: inviteMessage(g.name, g.emoji, g.invite_code),
      })} />
      {isOwner ? (
        <Button title="Gerar novo código" variant="ghost" loading={regenerate.isPending} onPress={() =>
          Alert.alert('Gerar novo código?', 'O código atual para de funcionar. Quem já está no grupo continua.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Gerar', onPress: () => regenerate.mutate() },
          ])} />
      ) : null}
    </>}>
      <Header title="Convidar" />
      <View style={{ alignItems: 'center', gap: space.xl, paddingTop: space.lg }}>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          Peça para a outra pessoa abrir o split-pix, tocar em Participar e ler este QR — ou digitar o código.
        </Text>
        <View style={{ padding: 18, backgroundColor: '#FFFFFF', borderRadius: 21, borderWidth: 1, borderColor: colors.divider }}>
          <QRCode value={inviteLink(g.invite_code)} size={194} color={colors.text} backgroundColor="#FFFFFF" />
        </View>
        <Text selectable style={{ fontSize: 32, fontWeight: '700', letterSpacing: 7, color: colors.text }}>{g.invite_code}</Text>
        <Text style={{ fontSize: 12, lineHeight: 15, color: colors.muted, textAlign: 'center' }}>
          Ao compartilhar, a mensagem já leva o link para baixar o app, para quem ainda não tem.
        </Text>
        <ErrorText>{regenerate.error?.message}</ErrorText>
      </View>
    </Screen>
  );
}
