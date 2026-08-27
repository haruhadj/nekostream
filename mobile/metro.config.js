const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// Metro refuses to resolve anything outside the project root unless it's
// listed here — the @shared/* alias in tsconfig.json resolves at typecheck
// time regardless, but silently fails at bundle time without this. See
// ../context/architecture.md's Dependency direction section: only the
// dependency-free lib/ modules (filters.ts, sort.ts, group.ts,
// providers.ts) are safe to share this way.
config.watchFolders = [path.resolve(__dirname, "../src/lib")];

module.exports = config;
