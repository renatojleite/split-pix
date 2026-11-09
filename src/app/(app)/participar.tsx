import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, EmojiTile, ErrorText, Field, Header, Input, Screen } from '@/components/ui';
import { previewInvite, useAcceptInvite } from '@/lib/api';
import type { InvitePreview } from '@/lib/types';
import { colors, space, type } from '@/theme';

const CODE = /[A-HJ-NP-Z2-9]{6}$/;

/** Aceita o código puro ou o conteúdo do QR (splitpix://convite/PX7K2M). */
function extractCode(text: string): string | null {
  const m = text.trim().toUpperCase().match(CODE);
  return m ? m[0] : null;
}

export default function Participar() {
  const params = useLocalSearchParams<{ code?: string }>();
  const fromLink = params.code ? extractCode(params.code) : null;
  const [code, setCode] = useState(fromLink ?? '');
  const [scanning, setScanning] = useState(false);
  // Código enviado para consulta (link/QR já chega enviado).
  const [submitted, setSubmitted] = useState<string | null>(fromLink);
  const [formatError, setFormatError] = useState<string | null>(null);

  const invite = useQuery({
    queryKey: ['invite', submitted],
    enabled: !!submitted,
    retry: false,
    queryFn: () => previewInvite(submitted!),
  });

  // Quem já é membro vai direto para o grupo.
  useEffect(() => {
    if (invite.data?.already_member) {
      router.replace({ pathname: '/g/[id]', params: { id: invite.data.group_id } });
    }
  }, [invite.data]);

  function lookup(value: string) {
    const c = extractCode(value);
    if (!c) return setFormatError('Código precisa ter 6 letras/números.');
    setFormatError(null);
    setCode(c);
    setSubmitted(c);
  }

  if (invite.data && !invite.data.already_member && submitted) {
    return <Claim invite={invite.data} code={submitted} onBack={() => setSubmitted(null)} />;
  }

  return (
    <Screen footer={<Button title="Continuar" onPress={() => lookup(code)} disabled={code.length !== 6} loading={invite.isFetching} />}>
      <Header title="Participar de um grupo" />
      <Field label="Código do convite" hint="Peça o código para quem criou o grupo.">
        <Input value={code} onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="PX7K2M" autoCapitalize="characters" autoCorrect={false} maxLength={6}
          style={{ height: 56, fontSize: 24, fontWeight: '700', letterSpacing: 8.8, textAlign: 'center' }} />
      </Field>
      <ErrorText>{formatError ?? invite.error?.message}</ErrorText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        <Text style={{ color: colors.muted }}>ou</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
      </View>
      {scanning ? (
        <Scanner onCode={(c) => { setScanning(false); lookup(c); }} />
      ) : (
        <Button title="Ler QR code" icon="camera" variant="secondary" onPress={() => setScanning(true)} />
      )}
    </Screen>
  );
}

function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <Card style={{ gap: space.md }}>
        <Text style={type.body}>Para ler o QR code, o app precisa da câmera.</Text>
        <Button title="Permitir câmera" onPress={requestPermission} />
      </Card>
    );
  }

  return (
    <View style={{ height: 264, borderRadius: 21, overflow: 'hidden', backgroundColor: '#18181B' }}>
      <CameraView style={{ flex: 1 }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(r: BarcodeScanningResult) => {
          if (done.current) return;
          if (extractCode(r.data)) {
            done.current = true;
            onCode(r.data);
          }
        }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
        <Text style={{ color: '#E4E4E7', fontSize: 12 }}>Aponte a câmera para o QR do grupo</Text>
      </View>
    </View>
  );
}

function Claim({ invite, code, onBack }: { invite: InvitePreview; code: string; onBack: () => void }) {
  const accept = useAcceptInvite();
  const [picked, setPicked] = useState<string | 'new' | null>(invite.unclaimed.length ? null : 'new');
  const [name, setName] = useState('');

  const valid = picked && (picked !== 'new' || name.trim());

  async function join() {
    const groupId = await accept.mutateAsync(
      picked === 'new' ? { code, name } : { code, memberId: picked! },
    );
    router.replace({ pathname: '/g/[id]', params: { id: groupId } });
  }

  return (
    <Screen footer={<Button title="Entrar no grupo" onPress={join} disabled={!valid} loading={accept.isPending} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 50 }}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Outro código</Text></Pressable>
      </View>
      <View style={{ alignItems: 'center', gap: 11 }}>
        <EmojiTile emoji={invite.emoji} size={64} />
        <Text style={type.title}>{invite.name}</Text>
      </View>
      <Text style={type.label}>Quem é você neste grupo?</Text>
      <Card style={{ padding: 0 }}>
        {invite.unclaimed.map((m) => (
          <Option key={m.id} label={`Sou ${m.display_name}`} selected={picked === m.id} onPress={() => setPicked(m.id)} />
        ))}
        <Option label="Sou outra pessoa" selected={picked === 'new'} onPress={() => setPicked('new')} last />
      </Card>
      {picked === 'new' ? (
        <Field label="Seu nome" hint="Você entra com 0% na divisão até alguém ajustar na aba Divisão.">
          <Input value={name} onChangeText={setName} placeholder="Seu nome" autoFocus />
        </Field>
      ) : null}
      <ErrorText>{accept.error?.message}</ErrorText>
    </Screen>
  );
}

function Option({ label, selected, onPress, last }: { label: string; selected: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={{ height: 50, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: 11,
        borderBottomWidth: last ? 0 : 1, borderColor: colors.divider }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.primary : colors.muted,
        alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 9, height: 9, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
      </View>
      <Text style={{ fontSize: 14, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}
