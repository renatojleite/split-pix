import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();
// Saída do splash um pouco mais suave (padrão é quase instantâneo).
SplashScreen.setOptions({ duration: 600, fade: true });
const SPLASH_MIN_MS = 900;
const startedAt = Date.now();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    // Mostra o logo por pelo menos SPLASH_MIN_MS mesmo quando a sessão carrega rápido.
    const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - startedAt));
    const t = setTimeout(() => SplashScreen.hideAsync(), wait);
    return () => clearTimeout(t);
  }, [loading]);

  // Segura o splash até saber se há sessão salva (evita piscar o login).
  if (loading) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Protected guard={!!session} redirectTo="/login">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session} redirectTo="/">
          <Stack.Screen name="login" />
          <Stack.Screen name="codigo" />
        </Stack.Protected>
        {/* Link do e-mail: precisa abrir com ou sem sessão. */}
        <Stack.Screen name="login-callback" />
      </Stack>
    </>
  );
}
