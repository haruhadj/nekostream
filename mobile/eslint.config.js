// This is a React Native/Expo project, not the Next.js web app — it gets
// its own lint setup rather than joining the root eslint.config.mjs (which
// is scoped away from mobile/**, see that file's ignores). Prettier
// formatting is still shared: prettier discovers the repo-root .prettierrc
// automatically since there's no closer one in mobile/.
//
// Deliberately not type-aware (no parserOptions.project), matching
// eslint-config-expo's own default — wiring up a type-checked lint pass
// for a React Native project's platform-suffixed files (.native.tsx,
// .web.tsx) is real setup cost outside Phase 2's scaffold scope. That
// means no-floating-promises (a type-aware rule, enforced at the root)
// isn't enforced here yet — worth revisiting once the app has real async
// call sites to protect (Phase 3+).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettier = require("eslint-config-prettier/flat");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = defineConfig([
  { ignores: [".expo/**", "dist/**"] },
  expoConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
]);
