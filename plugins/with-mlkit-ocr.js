// Pede ao Google Play Services para baixar o modelo de leitura de texto (ML Kit)
// já na instalação do app, em vez de no primeiro comprovante lido.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withMlkitOcr(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'com.google.mlkit.vision.DEPENDENCIES', 'ocr');
    return cfg;
  });
};
