/**
 * Android release configuration applied during `expo prebuild`:
 *  - signs release builds with the upload keystore given by environment variables
 *    (VGYAN_UPLOAD_STORE_FILE, VGYAN_UPLOAD_STORE_PASSWORD, VGYAN_UPLOAD_KEY_ALIAS,
 *    VGYAN_UPLOAD_KEY_PASSWORD). The keystore itself never enters the repository.
 *    Without them a release build fails instead of silently using the debug key, unless
 *    VGYAN_ALLOW_DEBUG_SIGNED_RELEASE=1 is set (CI smoke builds only; such APKs are labelled).
 *  - builds only the ARM ABIs used by real phones (smaller APK; Vosk and React Native both ship them).
 */
const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

const SIGNING = `
        release {
            def storePath = System.getenv("VGYAN_UPLOAD_STORE_FILE")
            if (storePath) {
                storeFile file(storePath)
                storePassword System.getenv("VGYAN_UPLOAD_STORE_PASSWORD")
                keyAlias System.getenv("VGYAN_UPLOAD_KEY_ALIAS")
                keyPassword System.getenv("VGYAN_UPLOAD_KEY_PASSWORD")
            }
        }`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes("VGYAN_UPLOAD_STORE_FILE")) return cfg;
    g = g.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`);
    g = g.replace(
      /(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/,
      (_m, head) =>
        `${head}if (System.getenv("VGYAN_UPLOAD_STORE_FILE")) {
                signingConfig signingConfigs.release
            } else if (System.getenv("VGYAN_ALLOW_DEBUG_SIGNED_RELEASE") == "1") {
                signingConfig signingConfigs.debug
            } else {
                throw new GradleException("Release signing keystore not configured (VGYAN_UPLOAD_STORE_FILE)")
            }`
    );
    cfg.modResults.contents = g;
    return cfg;
  });
}

function withArmOnly(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === "property" && p.key === "reactNativeArchitectures"));
    cfg.modResults.push({ type: "property", key: "reactNativeArchitectures", value: "armeabi-v7a,arm64-v8a" });
    return cfg;
  });
}

module.exports = (config) => withArmOnly(withReleaseSigning(config));
