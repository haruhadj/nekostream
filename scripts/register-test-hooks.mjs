/**
 * Test bootstrap: path-alias resolution plus a dummy environment.
 *
 * The dummy values are deliberate rather than a convenience — they guarantee a
 * test run can never authenticate against the real AniList/MyAnimeList APIs or
 * open the developer's actual database, whatever is in the ambient shell.
 */

import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);

const TEST_ENV = {
  DATABASE_URL: "file::memory:",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  ANILIST_CLIENT_ID: "test-anilist-id",
  ANILIST_CLIENT_SECRET: "test-anilist-secret",
  MAL_CLIENT_ID: "test-mal-id",
  MAL_CLIENT_SECRET: "test-mal-secret",
  MAL_CODE_VERIFIER: "a".repeat(64),
};

for (const [key, value] of Object.entries(TEST_ENV)) process.env[key] = value;
