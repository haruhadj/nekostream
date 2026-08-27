import js from "@eslint/js";
import next from "eslint-config-next";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // mobile/ is a separate Expo/React Native project with its own
    // tsconfig, tooling and lint setup (`expo lint`) — a different runtime
    // (RN, not DOM/Next) that this config's type-aware rules don't target.
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "public/**",
      "mobile/**",
    ],
  },
  js.configs.recommended,
  ...next,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The cleanup pass exists to remove these; keep them loud afterwards.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `onClick={async () => …}` is the normal React idiom; the rule's other
      // checks (conditionals, spreads) stay on.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "src/lib/test-support/**"],
    rules: {
      // node:test's `test()` returns a promise the runner awaits itself.
      "@typescript-eslint/no-floating-promises": "off",
      // Loading a module under mock.module means a cache-busted dynamic
      // import, which is inherently untyped until it is cast at the call site.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      // `const module = await import(...)` is a local, not Node's `module`.
      "@next/next/no-assign-module-variable": "off",
      // Rejecting with a non-Error is the case being tested.
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      // The stubs deliberately stand in for wider platform types.
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
  {
    // Plain JS scripts are outside the TS program.
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier
);
