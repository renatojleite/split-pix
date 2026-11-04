import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

const pad = (n: number) => n.toString().padStart(2, '0');

/** "v0.1.0 · atualização 04/11 14:32" (ou "· versão do APK" sem atualização baixada). */
export function versionLabel(): string {
  const version = `v${Constants.expoConfig?.version ?? '?'}`;
  const at = Updates.isEnabled && !Updates.isEmbeddedLaunch ? Updates.createdAt : null;
  if (!at) return `${version} · versão do APK`;
  return `${version} · atualização ${pad(at.getDate())}/${pad(at.getMonth() + 1)} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** Procura atualização agora; se tiver, baixa e reinicia o app na nova versão. */
export async function checkForUpdateNow(): Promise<void> {
  if (!Updates.isEnabled) {
    Alert.alert('Atualizar', 'Atualizações automáticas só funcionam no app instalado pelo APK.');
    return;
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      Alert.alert('Tudo em dia', `Você já está na versão mais recente.\n\n${versionLabel()}`);
      return;
    }
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // abre de novo já na versão nova
  } catch {
    Alert.alert('Não deu para atualizar', 'Confira a internet e tente de novo.');
  }
}
