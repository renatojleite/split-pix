// Link que sempre baixa o APK mais recente (publicado pelo GitHub Actions).
// Troque quando o app estiver na Play Store.
export const APK_DOWNLOAD_URL =
  process.env.EXPO_PUBLIC_APK_URL ??
  'https://github.com/renatojleite/split-pix/releases/latest/download/split-pix.apk';
