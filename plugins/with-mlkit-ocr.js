// Pede ao Google Play Services para baixar o modelo de leitura de texto (ML Kit)
// já na instalação do app, em vez de no primeiro comprovante lido.
// O expo-camera declara o mesmo meta-data com "barcode_ui" (QR do convite): juntamos os dois.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const NAME = 'com.google.mlkit.vision.DEPENDENCIES';

module.exports = function withMlkitOcr(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['meta-data'] = (app['meta-data'] ?? []).filter((m) => m.$['android:name'] !== NAME);
    app['meta-data'].push({ $: { 'android:name': NAME, 'android:value': 'barcode_ui,ocr', 'tools:replace': 'android:value' } });
    return cfg;
  });
};
