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

// A shared module under ../src/lib resolves bare imports relative to *itself*,
// so `import { XMLParser } from "fast-xml-parser"` inside nyaa/rss.ts looks in
// the repo root's node_modules — which Metro will not read, because it is
// outside both the project root and watchFolders. Pointing nodeModulesPaths at
// mobile/node_modules makes those imports resolve against this app's own
// dependency tree instead, which is where they belong: the app has to install
// what the modules it shares actually need (fast-xml-parser, zod), and the two
// package.json files stay independent.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
