/**
 * Only reason this file exists: babel-preset-expo alone doesn't resolve
 * @shared/* — Metro's watchFolders (metro.config.js) makes the physical
 * files outside mobile/ visible to the bundler, but the alias itself is
 * resolved here. tsconfig.json's matching "paths" entry covers typecheck
 * and editor resolution; this covers the actual bundle.
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
    ],
  };
};
