import { useLocalSearchParams } from 'expo-router';
import { Alert, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, ErrorText, Header, Loading, Screen } from '@/components/ui';
import { useGroup, useRegenerateInvite } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { colors, space } from '@/theme';

const inviteLink =(code: string) => `splitpix://convite/${code}`;

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
        message: `Entra no grupo "${g.name}" no split-pix! Código: ${g.invite_code}\n${inviteLink(g.invite_code)}`,
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
        <Text style={{ fontSize: 16, color: colors.muted, textAlign: 'center' }}>
          Peça para a outra pessoa abrir o split-pix, tocar em Participar e ler este QR — ou digitar o código.
        </Text>
        <View style={{ padding: 20, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.divider }}>
          <QRCode value={inviteLink(g.invite_code)} size={220} color={colors.text} backgroundColor="#FFFFFF" />
        </View>
        <Text selectable style={{ fontSize: 36, fontWeight: '700', letterSpacing: 8, color: colors.text }}>{g.invite_code}</Text>
        <ErrorText>{regenerate.error?.message}</ErrorText>
      </View>
    </Screen>
  );
}
