import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Button, ErrorText, Header, Screen } from '@/components/ui';
import { sendCode, verifyCode } from '@/lib/auth';
import { colors, radius, type } from '@/theme';

const LENGTH = 6;
const RESEND_SECONDS = 60;

export default function Codigo() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, value);
      // A sessão nova troca a pilha protegida sozinha (ver _layout).
    } catch {
      setError('Código inválido ou expirado.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  function onChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (digits.length === LENGTH) verify(digits);
  }

  async function resend() {
    setWait(RESEND_SECONDS);
    try {
      await sendCode(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível reenviar.');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false}
        footer={<Button title="Entrar" onPress={() => verify(code)} disabled={code.length !== LENGTH} loading={busy} />}>
        <Header />
        <View style={{ gap: 7 }}>
          <Text style={type.screenTitle}>Confira seu e-mail</Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.muted }}>
            Enviamos um e-mail para <Text style={{ color: colors.text, fontWeight: '600' }}>{email}</Text>.
            Abra neste celular e toque no link: o split-pix abre já conectado.
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
            Se o e-mail trouxer um código de 6 dígitos, digite abaixo.
          </Text>
        </View>

        {/* Um input invisível recebe os dígitos; as caixas só desenham. */}
        <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Código de 6 dígitos"
          style={{ flexDirection: 'row', gap: 7 }}>
          {Array.from({ length: LENGTH }, (_, i) => {
            const active = i === code.length;
            return (
              <View key={i} style={{
                flex: 1, height: 53, borderRadius: 12, backgroundColor: active ? colors.surface : colors.card,
                borderWidth: active ? 2 : 0, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 23, fontWeight: '600', color: colors.text }}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput ref={input} value={code} onChangeText={onChange} autoFocus keyboardType="number-pad"
          textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={LENGTH}
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }} />

        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          {wait > 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Não chegou? Reenviar em 0:{wait.toString().padStart(2, '0')} ·{' '}
            </Text>
          ) : (
            <Pressable onPress={resend} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Reenviar código · </Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>trocar e-mail</Text>
          </Pressable>
        </View>
        <View style={{ height: radius.card }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
