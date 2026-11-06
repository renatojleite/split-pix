import { getShareExtensionKey } from 'expo-share-intent';

// Comprovante compartilhado de outro app (banco) chega como deep link: manda para a leitura.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/comprovante?shared=1';
    return path;
  } catch {
    return '/';
  }
}
