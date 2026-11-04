import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="g/[id]/convite" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
