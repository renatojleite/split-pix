import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Avatar, Button, Card, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useProfile, useUpdateProfileName } from '@/lib/api';
import { authError, setPassword, signOut, useUserId } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import { colors, type } from '@/theme';

export default function Perfil() {
  const userId = useUserId();
  const profile = useProfile(userId);
  if (!profile.data) return <Screen><Header title="Perfil" /><Loading /></Screen>;
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useUpdateProfileName(profile.id);
  const [name, setName] = useState(profile.name);
  const changed = !!name.trim() && name.trim() !== profile.name;

  return (
    <Screen footer={<Button title="Sair" variant="danger" icon="logout" onPress={() =>
      Alert.alert('Sair da conta?', 'Você entra de novo com e-mail e senha.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => signOut() },
      ])} />}>
      <Header title="Perfil" />
      <View style={{ alignItems: 'center', gap: 11, paddingVertical: 7 }}>
        <Avatar name={name || profile.email || '?'} color={colors.primary} size={77} />
        <Text style={type.title}>{name || 'Sem nome'}</Text>
      </View>
      <Field label="Nome" hint="É como seu nome aparece nos grupos que você criar.">
        <Input value={name} onChangeText={setName} placeholder="Seu nome" />
      </Field>
      {changed ? <Button title="Salvar nome" onPress={() => save.mutate(name)} loading={save.isPending} /> : null}
      <Card style={{ gap: 3 }}>
        <Text style={type.caption}>E-mail</Text>
        <Text style={type.body}>{profile.email}</Text>
      </Card>
      <PasswordBox />
    </Screen>
  );
}

/** Definir ou trocar a senha (contas antigas entravam só por código e não têm senha). */
function PasswordBox() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await setPassword(pw);
      setPw('');
      setOpen(false);
      setMsg({ ok: true, text: 'Senha salva ✓ Use-a para entrar nos outros celulares.' });
    } catch (e) {
      setMsg({ ok: false, text: authError(e, 'Não foi possível salvar a senha.') });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 9 }}>
      <Text style={type.caption}>Senha</Text>
      {open ? (
        <>
          <Input value={pw} onChangeText={setPw} placeholder="nova senha (mín. 6)" secureTextEntry autoCapitalize="none"
            autoComplete="new-password" textContentType="newPassword" style={{ backgroundColor: colors.surface }} />
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <Button title="Cancelar" variant="secondary" style={{ flex: 1, height: 44 }} onPress={() => { setOpen(false); setPw(''); }} />
            <Button title="Salvar senha" style={{ flex: 1, height: 44 }} disabled={pw.length < 6} loading={busy} onPress={save} />
          </View>
        </>
      ) : (
        <Button title="Definir ou trocar senha" variant="secondary" onPress={() => { setOpen(true); setMsg(null); }} />
      )}
      {msg ? <Text style={{ fontSize: 13, color: msg.ok ? colors.positive : colors.negative }}>{msg.text}</Text> : null}
    </Card>
  );
}
