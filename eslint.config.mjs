import js from "@eslint/js";
import next from "eslint-config-next";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**", "public/**"],
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
    // node:test's `test()` returns a promise that the runner awaits itself.
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
  {
    // Plain JS scripts are outside the TS program.
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier
);
