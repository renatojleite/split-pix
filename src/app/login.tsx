import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Logo } from '@/components/icons';
import { Button, ErrorText, Field, Input, Screen } from '@/components/ui';
import { sendCode, authError } from '@/lib/auth';
import { colors, type } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL.test(email.trim());

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      router.push({ pathname: '/codigo', params: { email: email.trim().toLowerCase() } });
    } catch (e) {
      setError(authError(e, 'Não foi possível enviar o código.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false}
        footer={<>
          <Button title="Enviar código" onPress={submit} disabled={!valid} loading={busy} />
          <Text style={[type.caption, { textAlign: 'center' }]}>
            Ao continuar você aceita os Termos de uso e a Política de privacidade.
          </Text>
        </>}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 64 }}>
          <Logo size={38} />
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.4 }}>split·pix</Text>
        </View>
        <View style={{ gap: 7, marginTop: 14 }}>
          <Text style={type.screenTitle}>Entre com seu e-mail</Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.muted }}>
            Sem senha: mandamos um código de 6 dígitos para você confirmar.
          </Text>
        </View>
        <Field label="E-mail">
          <Input value={email} onChangeText={setEmail} placeholder="voce@email.com" autoFocus
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
            returnKeyType="send" onSubmitEditing={() => valid && submit()} />
        </Field>
        <ErrorText>{error}</ErrorText>
      </Screen>
    </KeyboardAvoidingView>
  );
}
