// Turns on R8's code optimizations. Expo's template uses "proguard-android.txt", which ships `-dontoptimize`, so release builds
// were only shrunk and obfuscated. "proguard-android-optimize.txt" keeps shrinking and obfuscation and adds optimization.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withR8Optimize(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = cfg.modResults.contents.replace(/getDefaultProguardFile\((["'])proguard-android\.txt\1\)/g, 'getDefaultProguardFile("proguard-android-optimize.txt")');
    }
    return cfg;
  });
};
