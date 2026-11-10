import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Logo } from '@/components/icons';
import { UpdateBanner } from '@/components/update-banner';
import { Button, ErrorText, Field, Input, Screen } from '@/components/ui';
import { checkForUpdateNow, versionLabel } from '@/lib/app-version';
import { authError, signInWithPassword, signUpWithPassword } from '@/lib/auth';
import { colors, type } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Login por e-mail + senha (o envio de código por e-mail fica em espera até ter SMTP próprio).
// Ao entrar, o AuthProvider troca para as telas do app sozinho.
export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPasswordText] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const creating = mode === 'up';
  const valid = EMAIL.test(email.trim()) && password.length >= 6 && (!creating || password === confirm);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (creating) await signUpWithPassword(email, password);
      else await signInWithPassword(email, password);
    } catch (e) {
      setError(authError(e, creating ? 'Não foi possível criar a conta.' : 'Não foi possível entrar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Screen
        footer={<>
          <Button title={creating ? 'Criar conta' : 'Entrar'} onPress={submit} disabled={!valid} loading={busy} />
          <Pressable onPress={() => { setMode(creating ? 'in' : 'up'); setError(null); }} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary, textAlign: 'center' }}>
              {creating ? 'Já tenho conta · Entrar' : 'Não tem conta? Criar conta'}
            </Text>
          </Pressable>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            Ao continuar você aceita os Termos de uso e a Política de privacidade.
          </Text>
          {/* Atualizar o app sem precisar entrar (ex.: correção no login). */}
          <Pressable onPress={async () => { setChecking(true); await checkForUpdateNow(); setChecking(false); }} disabled={checking}
            hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            {checking ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
              split·pix {versionLabel()} · <Text style={{ fontWeight: '700', color: colors.primary }}>{checking ? 'Procurando…' : 'Atualizar versão'}</Text>
            </Text>
          </Pressable>
        </>}>
        <UpdateBanner />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 48 }}>
          <Logo size={38} />
          <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.4 }}>split·pix</Text>
        </View>
        <View style={{ gap: 7, marginTop: 14 }}>
          <Text style={type.screenTitle}>{creating ? 'Crie sua conta' : 'Entre na sua conta'}</Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: colors.muted }}>
            {creating ? 'Use seu e-mail e escolha uma senha de pelo menos 6 caracteres.' : 'Use seu e-mail e senha.'}
          </Text>
        </View>
        <Field label="E-mail">
          <Input value={email} onChangeText={setEmail} placeholder="voce@email.com"
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        </Field>
        <Field label="Senha">
          <View>
            <Input value={password} onChangeText={setPasswordText} placeholder="mínimo 6 caracteres" secureTextEntry={!show}
              autoCapitalize="none" autoComplete={creating ? 'new-password' : 'current-password'}
              textContentType={creating ? 'newPassword' : 'password'} returnKeyType={creating ? 'next' : 'go'}
              onSubmitEditing={() => !creating && submit()} style={{ paddingRight: 70 }} />
            <Pressable onPress={() => setShow(!show)} hitSlop={8} accessibilityRole="button"
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>{show ? 'Ocultar' : 'Mostrar'}</Text>
            </Pressable>
          </View>
        </Field>
        {creating ? (
          <Field label="Repita a senha">
            <Input value={confirm} onChangeText={setConfirm} placeholder="a mesma senha" secureTextEntry={!show}
              autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit} />
          </Field>
        ) : null}
        {creating && confirm && password !== confirm ? <ErrorText>As senhas não são iguais.</ErrorText> : null}
        <ErrorText>{error}</ErrorText>
      </Screen>
    </>
  );
}
