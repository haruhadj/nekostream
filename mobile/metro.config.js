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

// drizzle-kit's generated drizzle/migrations.js imports the .sql files so the
// migrations ship in the bundle; Metro won't resolve an extension it doesn't
// know. babel.config.js's inline-import plugin is the other half — without
// both, the import resolves to nothing and useMigrations silently applies no
// migrations.
config.resolver.sourceExts.push("sql");

module.exports = config;
