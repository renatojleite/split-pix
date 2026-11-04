import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, Chip, ErrorText, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useGroup, useSaveEntry, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { today } from '@/lib/dates';
import { centsFromInput, formatBRL, inputFromCents } from '@/lib/money';
import { buildPixPayload, normalizePixKey, type PixKeyType } from '@/lib/pix';
import { PREF, usePref, type PixProfile } from '@/lib/prefs';
import { colors, space } from '@/theme';

// from/to/amount vêm do cartão de saldo; pelo menu do grupo chegam vazios (cobrança livre).
type Params = { id: string; from?: string; to?: string; amount?: string };

const KEY_TYPES: { value: PixKeyType; label: string; placeholder: string; keyboard: 'default' | 'number-pad' | 'phone-pad' | 'email-address' }[] = [
  { value: 'cpf', label: 'CPF/CNPJ', placeholder: '000.000.000-00', keyboard: 'number-pad' },
  { value: 'phone', label: 'Celular', placeholder: '(11) 98765-4321', keyboard: 'phone-pad' },
  { value: 'email', label: 'E-mail', placeholder: 'voce@email.com', keyboard: 'email-address' },
  { value: 'random', label: 'Aleatória', placeholder: '123e4567-e89b-12d3-…', keyboard: 'default' },
];

export default function PixScreen() {
  const params = useLocalSearchParams<Params>();
  const group = useGroup(params.id);
  if (!group.data) return <Screen><Header title="Pix" /><Loading /></Screen>;
  return <PixForm params={params} detail={group.data} />;
}

function PixForm({ params, detail }: { params: Params; detail: GroupDetail }) {
  const userId = useUserId();
  const save = useSaveEntry(detail.group.id);
  const me = detail.members.find((m) => m.user_id === userId);
  const others = detail.members.filter((m) => m.id !== me?.id);
  const fromDebt = !!params.from;
  // Quem paga: o devedor do saldo, ou escolhido na hora (único outro membro já vem marcado).
  const [payerId, setPayerId] = useState<string | null>(params.from ?? (others.length === 1 ? others[0].id : null));
  const payer = detail.members.find((m) => m.id === payerId);
  const receiverId = params.to ?? me?.id;

  const [saved, setSaved] = usePref<PixProfile | null>(PREF.pix, null);
  const [editingKey, setEditingKey] = useState(!saved);
  const [keyType, setKeyType] = useState<PixKeyType>(saved?.keyType ?? 'phone');
  const [key, setKey] = useState(saved?.key ?? '');
  const [name, setName] = useState(saved?.name ?? me?.display_name ?? '');
  const [city, setCity] = useState(saved?.city ?? '');
  const [amount, setAmount] = useState(Number(params.amount) || 0);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  let keyError: string | null = null;
  try {
    if (key.trim()) normalizePixKey(keyType, key);
  } catch (e) {
    keyError = e instanceof Error ? e.message : 'Chave inválida';
  }
  const ready = !!key.trim() && !keyError && !!name.trim() && amount > 0;

  const payload = ready
    ? buildPixPayload({
        keyType, key, name, city, amountCents: amount,
        description: `split-pix ${detail.group.name}`,
        txid: `SPLITPIX${detail.group.invite_code}`,
      })
    : null;

  function generate() {
    setSaved({ keyType, key: key.trim(), name: name.trim(), city: city.trim() });
    setEditingKey(false);
    setGenerated(true);
  }

  const message = payload
    ? [
        `💸 Pix do split-pix — ${detail.group.emoji} ${detail.group.name}`,
        '',
        `Valor: *${formatBRL(amount)}*`,
        `Para: ${name.trim()}`,
        '',
        'No app do seu banco: Pix › *Pix Copia e Cola*, e cole o código abaixo:',
        '',
        payload,
      ].join('\n')
    : '';

  async function copy() {
    if (!payload) return;
    await Clipboard.setStringAsync(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function sendWhatsApp() {
    try {
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
    } catch {
      // WhatsApp não instalado: cai no menu de compartilhar do sistema.
      await Share.share({ message });
    }
  }

  async function registerSettlement() {
    Alert.alert(
      'Registrar acerto?',
      `Confirme no app do seu banco que o Pix de ${formatBRL(amount)} de ${payer?.display_name} chegou. O split-pix não consegue verificar. O valor entra como acerto de ${payer?.display_name} para você e ajusta o saldo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recebi, registrar',
          onPress: async () => {
            await save.mutateAsync({
              type: 'transfer', title: 'Acerto via Pix', amountCents: amount,
              paidBy: payerId!, transferTo: receiverId!, occurredOn: today(), splitMode: 'default', emoji: '💸',
            });
            router.back();
          },
        },
      ],
    );
  }

  const typeInfo = KEY_TYPES.find((t) => t.value === keyType)!;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={!generated ? (
        <Button title="Gerar QR Pix" onPress={generate} disabled={!ready} />
      ) : (
        <>
          <ErrorText>{save.error?.message}</ErrorText>
          {payerId && receiverId ? (
            <Button title="Já recebi — registrar acerto" variant="positive" onPress={registerSettlement} loading={save.isPending} />
          ) : (
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
              Escolha quem vai pagar para poder registrar o acerto depois.
            </Text>
          )}
        </>
      )}>
        <Header title={fromDebt ? 'Receber via Pix' : 'Criar pagamento Pix'} />
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted }}>
          {payer?.display_name ?? 'Quem for pagar'} lê o QR (ou cola o código) no app do banco, e o valor já vem preenchido.
        </Text>

        {!fromDebt && others.length > 0 ? (
          <Field label="Quem vai pagar">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {others.map((m) => (
                <Chip key={m.id} label={m.display_name} color={m.color} selected={payerId === m.id}
                  onPress={() => setPayerId(payerId === m.id ? null : m.id)} />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label="Valor">
          <Input big value={amount ? `R$ ${inputFromCents(amount)}` : ''} placeholder="R$ 0,00" keyboardType="number-pad"
            onChangeText={(t) => setAmount(centsFromInput(t))} />
        </Field>

        {editingKey ? (
          <Card style={{ gap: space.md }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Sua chave Pix</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {KEY_TYPES.map((t) => (
                <Chip key={t.value} label={t.label} selected={keyType === t.value} onPress={() => setKeyType(t.value)} />
              ))}
            </View>
            <Input value={key} onChangeText={setKey} placeholder={typeInfo.placeholder} keyboardType={typeInfo.keyboard}
              autoCapitalize="none" autoCorrect={false} style={{ backgroundColor: colors.surface }} />
            {key.trim() && keyError ? <ErrorText>{keyError}</ErrorText> : null}
            <Input value={name} onChangeText={setName} placeholder="Nome de quem recebe" maxLength={40}
              style={{ backgroundColor: colors.surface }} />
            <Input value={city} onChangeText={setCity} placeholder="Cidade (opcional)" maxLength={30}
              style={{ backgroundColor: colors.surface }} />
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}>
              Fica salva só neste celular, para as próximas vezes. Não é enviada ao grupo.
            </Text>
          </Card>
        ) : (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Recebe em ({typeInfo.label})</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }} numberOfLines={1}>{key}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>{name}</Text>
            </View>
            <Pressable onPress={() => { setEditingKey(true); setGenerated(false); }} hitSlop={8}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>Alterar</Text>
            </Pressable>
          </Card>
        )}

        {generated && payload ? (
          <View style={{ gap: space.md, alignItems: 'center' }}>
            <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.divider }}>
              <QRCode value={payload} size={240} color="#000000" backgroundColor="#FFFFFF" ecl="M" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{formatBRL(amount)}</Text>
            <Card style={{ alignSelf: 'stretch', gap: 6 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Pix copia e cola</Text>
              <Text selectable numberOfLines={3} style={{ fontSize: 12, color: colors.textSoft, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                {payload}
              </Text>
            </Card>
            <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' }}>
              <Button title={copied ? 'Copiado ✓' : 'Copiar'} icon="copy" variant="secondary" onPress={copy} style={{ flex: 1 }} />
              <Button title="WhatsApp" icon="share" variant="positive" onPress={sendWhatsApp} style={{ flex: 1 }} />
            </View>
            <Button title="Compartilhar em outro app" variant="ghost" onPress={() => Share.share({ message })} style={{ alignSelf: 'stretch' }} />
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' }}>
              O split-pix só gera o código e não acompanha o pagamento. Quando o Pix cair, registre o acerto para zerar o saldo.
            </Text>
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
