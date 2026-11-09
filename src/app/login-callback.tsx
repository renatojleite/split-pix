import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Logo } from '@/components/icons';
import { Button } from '@/components/ui';
import { sessionFromUrl, authError } from '@/lib/auth';
import { colors } from '@/theme';

/** O link do e-mail abre splitpix://login-callback#access_token=… e cai aqui. */
export default function LoginCallback() {
  const url = useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    sessionFromUrl(url)
      .then((ok) => {
        if (!alive) return;
        if (ok) router.replace('/');
        else setError('Este link não trouxe um acesso válido. Peça outro.');
      })
      .catch((e: unknown) => alive && setError(authError(e, 'Não foi possível entrar.')));
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 29, backgroundColor: colors.surface }}>
      <Logo size={56} />
      {error ? (
        <>
          <Text style={{ fontSize: 15, color: colors.text, textAlign: 'center' }}>{error}</Text>
          <Button title="Voltar ao login" onPress={() => router.replace('/login')} style={{ alignSelf: 'stretch' }} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ fontSize: 14, color: colors.muted }}>Entrando…</Text>
        </>
      )}
    </View>
  );
}
