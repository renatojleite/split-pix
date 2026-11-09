import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Avatar, Button, Card, Field, Header, Input, Loading, Screen } from '@/components/ui';
import { useProfile, useUpdateProfileName } from '@/lib/api';
import { signOut, useUserId } from '@/lib/auth';
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
      Alert.alert('Sair da conta?', 'Você entra de novo com o código por e-mail.', [
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
    </Screen>
  );
}
