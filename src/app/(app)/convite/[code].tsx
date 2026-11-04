import { Redirect, useLocalSearchParams } from 'expo-router';

// Deep link splitpix://convite/PX7K2M (é o que o QR code carrega).
export default function ConviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/participar', params: { code } }} />;
}
