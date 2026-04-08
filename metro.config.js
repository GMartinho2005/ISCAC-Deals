const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Adicionamos 'db' e 'sqlite3' para o Metro aceitar ambos
config.resolver.assetExts.push('db');
config.resolver.assetExts.push('sqlite3');

module.exports = withNativeWind(config, { input: "./global.css" });