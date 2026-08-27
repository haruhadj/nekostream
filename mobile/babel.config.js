/**
 * Two things babel-preset-expo doesn't do on its own:
 *
 * 1. **@shared/*** — Metro's watchFolders (metro.config.js) makes the
 *    physical files outside mobile/ visible to the bundler, but the alias
 *    itself is resolved here. tsconfig.json's matching "paths" entry covers
 *    typecheck and editor resolution; this covers the actual bundle.
 * 2. **.sql imports** — drizzle-kit's generated `drizzle/migrations.js`
 *    imports each migration's .sql file so it ships inside the bundle.
 *    inline-import turns those into string literals at build time;
 *    metro.config.js's `sourceExts` addition is the other half.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: { "@shared": "../src/lib" },
        },
      ],
      ["inline-import", { extensions: [".sql"] }],
    ],
  };
};
