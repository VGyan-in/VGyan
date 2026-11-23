// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "modules/*/android/*"],
  },
  {
    // Node build scripts.
    files: ["scripts/**/*.js", "plugins/**/*.js"],
    languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly" } },
  },
]);
