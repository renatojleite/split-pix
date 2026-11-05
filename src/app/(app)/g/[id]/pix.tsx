import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button, Card, Chip, ErrorText, Field, Header, Input, Loading, Screen, Segmented } from '@/components/ui';
import { useGroup, useSaveEntry, useSetMemberPix, type GroupDetail } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { today } from '@/lib/dates';
import { centsFromInput, formatBRL, inputFromCents } from '@/lib/money';
import { buildPixPayload, normalizePixKey, PIX_KEY_TYPES, type PixKeyType } from '@/lib/pix';
import { PREF, usePref, type PixProfile } from '@/lib/prefs';
import type { Member } from '@/lib/types';
import { colors, space } from '@/theme';

type Mode = 'receive' | 'pay';

// Do cartão de saldo vêm mode/from/to/amount; pelo menu do grupo chegam vazios (Pix livre).
type Params = { id: string; mode?: Mode; from?: string; to?: string; amount?: string };


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
  const fromDebt = !!params.from; // veio de um saldo: modo e pessoas já definidos

  const setMemberPix = useSetMemberPix(detail.group.id);
  // A chave vem do grupo (cadastro do participante). As salvas neste celular ficam como reserva
  // (versões antigas do app e chaves de quem já tem conta mas ainda não cadastrou a própria).
  const [myKey, setMyKey] = usePref<PixProfile | null>(PREF.pix, null);
  const [othersKeys, setOthersKeys] = usePref<Record<string, PixProfile>>(PREF.pixOthers, {});
  const fromRow = (m: Member | undefined): PixProfile | null =>
    m?.pix_key_type && m.pix_key ? { keyType: m.pix_key_type, key: m.pix_key, name: m.pix_name ?? m.display_name, city: m.pix_city ?? '' } : null;

  const initialMode: Mode = params.mode ?? 'receive';
  const initialOther =
    (initialMode === 'receive' ? params.from : params.to) ?? (others.length === 1 ? others[0].id : null);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [otherId, setOtherId] = useState<string | null>(initialOther ?? null);
  const other = detail.members.find((m) => m.id === otherId);

  const profileFor = (m: Mode, oid: string | null): PixProfile | null =>
    m === 'receive'
      ? fromRow(me) ?? myKey
      : oid ? fromRow(detail.members.find((x) => x.id === oid)) ?? othersKeys[oid] ?? null : null;
  const defaultName = (m: Mode, oid: string | null) =>
    m === 'receive' ? me?.display_name ?? '' : detail.members.find((x) => x.id === oid)?.display_name ?? '';

  const start = profileFor(initialMode, initialOther ?? null);
  const [editingKey, setEditingKey] = useState(!start);
  const [keyType, setKeyType] = useState<PixKeyType>(start?.keyType ?? 'phone');
  const [key, setKey] = useState(start?.key ?? '');
  const [name, setName] = useState(start?.name ?? defaultName(initialMode, initialOther ?? null));
  const [city, setCity] = useState(start?.city ?? '');
  const [amount, setAmount] = useState(Number(params.amount) || 0);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Troca de modo ou de pessoa: carrega a chave correspondente (se já salva). */
  function switchTo(m: Mode, oid: string | null) {
    const p = profileFor(m, oid);
    setMode(m);
    setOtherId(oid);
    setKeyType(p?.keyType ?? 'phone');
    setKey(p?.key ?? '');
    setName(p?.name ?? defaultName(m, oid));
    setCity(p?.city ?? '');
    setEditingKey(!p);
    setGenerated(false);
  }

  const payerId = mode === 'receive' ? otherId : me?.id ?? null;
  const receiverId = mode === 'receive' ? me?.id ?? null : otherId;
  const otherName = other?.display_name ?? (mode === 'receive' ? 'quem for pagar' : 'quem vai receber');

  let keyError: string | null = null;
  try {
    if (key.trim()) normalizePixKey(keyType, key);
  } catch (e) {
    keyError = e instanceof Error ? e.message : 'Chave inválida';
  }
  const ready = !!key.trim() && !keyError && !!name.trim() && amount > 0 && (mode === 'receive' || !!otherId);

  const payload = ready
    ? buildPixPayload({
        keyType, key, name, city, amountCents: amount,
        description: `split-pix ${detail.group.name}`,
        txid: `SPLITPIX${detail.group.invite_code}`,
      })
    : null;

  function generate() {
    const profile = { keyType, key: key.trim(), name: name.trim(), city: city.trim() };
    if (mode === 'receive') setMyKey(profile);
    else if (otherId) setOthersKeys({ ...othersKeys, [otherId]: profile });
    // Guarda no grupo quando pode: a própria chave, ou a de quem ainda não tem conta.
    const target = mode === 'receive' ? me : other;
    const row = fromRow(target);
    const normalized = normalizePixKey(keyType, key);
    if (target && (target.user_id === userId || !target.user_id)
      && (row?.key !== normalized || row?.keyType !== keyType || row?.name !== profile.name || row?.city !== profile.city)) {
      setMemberPix.mutate({ memberId: target.id, profile: { ...profile, key: normalized } });
    }
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
        'No app do banco: Pix › *Pix Copia e Cola*, e cole o código abaixo:',
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
      await Share.share({ message }); // sem WhatsApp: menu de compartilhar do sistema
    }
  }

  function registerSettlement() {
    const text = mode === 'receive'
      ? `Confirme no app do seu banco que o Pix de ${formatBRL(amount)} de ${otherName} chegou. O split-pix não consegue verificar. O valor entra como acerto de ${otherName} para você e ajusta o saldo.`
      : `Registre depois de concluir o Pix de ${formatBRL(amount)} no seu banco. O valor entra como acerto seu para ${otherName} e ajusta o saldo.`;
    Alert.alert('Registrar acerto?', text, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: mode === 'receive' ? 'Recebi, registrar' : 'Paguei, registrar',
        onPress: async () => {
          await save.mutateAsync({
            type: 'transfer', title: 'Acerto via Pix', amountCents: amount,
            paidBy: payerId!, transferTo: receiverId!, occurredOn: today(), splitMode: 'default', emoji: '💸',
          });
          router.back();
        },
      },
    ]);
  }

  const typeInfo = PIX_KEY_TYPES.find((t) => t.value === keyType)!;
  const canRegister = !!payerId && !!receiverId && payerId !== receiverId;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen footer={!generated ? (
        <Button title={mode === 'receive' ? 'Gerar QR Pix' : 'Gerar código Pix'} onPress={generate} disabled={!ready} />
      ) : (
        <>
          <ErrorText>{save.error?.message}</ErrorText>
          {canRegister ? (
            <Button title={mode === 'receive' ? 'Já recebi — registrar acerto' : 'Já paguei — registrar acerto'}
              variant="positive" onPress={registerSettlement} loading={save.isPending} />
          ) : (
            <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
              Escolha a outra pessoa para poder registrar o acerto depois.
            </Text>
          )}
        </>
      )}>
        <Header title={mode === 'receive' ? 'Receber via Pix' : 'Pagar via Pix'} />

        {!fromDebt ? (
          <Segmented<Mode> value={mode} onChange={(m) => switchTo(m, otherId)} options={[
            { value: 'receive', label: 'Vou receber' },
            { value: 'pay', label: 'Vou pagar' },
          ]} />
        ) : null}

        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
          {mode === 'receive'
            ? `${otherName[0].toUpperCase()}${otherName.slice(1)} lê o QR (ou cola o código) no app do banco, e o valor já vem preenchido.`
            : `Gere o código com a chave de ${otherName}, copie e cole no app do seu banco em Pix › Copia e Cola: valor e quem recebe já vêm preenchidos.`}
        </Text>

        {!fromDebt && others.length > 0 ? (
          <Field label={mode === 'receive' ? 'Quem vai pagar' : 'Para quem'}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {others.map((m) => (
                <Chip key={m.id} label={m.display_name} color={m.color} selected={otherId === m.id}
                  onPress={() => (mode === 'pay' ? switchTo('pay', otherId === m.id ? null : m.id) : setOtherId(otherId === m.id ? null : m.id))} />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label="Valor">
          <Input big value={amount ? `R$ ${inputFromCents(amount)}` : ''} placeholder="R$ 0,00" keyboardType="number-pad"
            onChangeText={(t) => { setAmount(centsFromInput(t)); setGenerated(false); }} />
        </Field>

        {mode === 'pay' && !otherId ? null : editingKey ? (
          <Card style={{ gap: space.md }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
              {mode === 'receive' ? 'Sua chave Pix' : `Chave Pix de ${otherName}`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PIX_KEY_TYPES.map((t) => (
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
            <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted }}>
              {mode === 'receive' || !other?.user_id
                ? 'Fica salva no grupo, visível só para os membros. Aparece também no relatório.'
                : `Peça a chave para ${otherName}. Fica salva neste celular; ${otherName} pode cadastrar a própria em Divisão › Participantes.`}
            </Text>
          </Card>
        ) : (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {mode === 'receive' ? 'Você recebe em' : `${otherName} recebe em`} ({typeInfo.label})
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{key}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>{name}</Text>
            </View>
            <Pressable onPress={() => { setEditingKey(true); setGenerated(false); }} hitSlop={8}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Alterar</Text>
            </Pressable>
          </Card>
        )}

        {generated && payload ? (
          <View style={{ gap: space.md, alignItems: 'center' }}>
            {mode === 'pay' ? (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{formatBRL(amount)}</Text>
                <Button title={copied ? 'Código copiado ✓ — agora cole no banco' : 'Copiar código Pix'} icon="copy"
                  onPress={copy} style={{ alignSelf: 'stretch' }} />
                <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted, textAlign: 'center' }}>
                  No app do seu banco: Pix › Pix Copia e Cola › colar. Confira o nome de {otherName} antes de confirmar.
                </Text>
              </>
            ) : null}
            <View style={{ padding: 13, backgroundColor: '#FFFFFF', borderRadius: 19, borderWidth: 1, borderColor: colors.divider }}>
              <QRCode value={payload} size={mode === 'pay' ? 180 : 240} color="#000000" backgroundColor="#FFFFFF" ecl="M" />
            </View>
            {mode === 'receive' ? (
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{formatBRL(amount)}</Text>
            ) : null}
            <Card style={{ alignSelf: 'stretch', gap: 5 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Pix copia e cola</Text>
              <Text selectable numberOfLines={3} style={{ fontSize: 11, color: colors.textSoft, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                {payload}
              </Text>
            </Card>
            {mode === 'receive' ? (
              <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' }}>
                <Button title={copied ? 'Copiado ✓' : 'Copiar'} icon="copy" variant="secondary" onPress={copy} style={{ flex: 1 }} />
                <Button title="WhatsApp" icon="share" variant="positive" onPress={sendWhatsApp} style={{ flex: 1 }} />
              </View>
            ) : null}
            <Button title="Compartilhar em outro app" variant="ghost" onPress={() => Share.share({ message })} style={{ alignSelf: 'stretch' }} />
            <Text style={{ fontSize: 11, lineHeight: 14, color: colors.muted, textAlign: 'center' }}>
              O split-pix só gera o código e não acompanha o pagamento. Depois do Pix, registre o acerto para atualizar o saldo.
            </Text>
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
