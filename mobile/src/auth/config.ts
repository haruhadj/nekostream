/**
 * The two OAuth client ids, and the redirect URIs they must be registered
 * against.
 *
 * These are *not* the server's client ids. Both provider consoles take one
 * redirect URI per client and the server's point at the server, so the mobile
 * app needs its own registrations — see planning/STANDALONE.md's decisions.
 * Neither id is a secret: AniList's implicit grant and MAL's public-client
 * PKCE flow are designed to be driven by a client id alone (verified against
 * MAL's docs, 2026-08-27). What must never appear here is a client *secret*.
 *
 * Baked into app.json's `extra` at build time, following the same reasoning as
 * the server URL before it: one operator, one build, no reason to ask at
 * runtime for something the build already knows. An unset id is reported on
 * the login screen rather than failing at the provider.
 */

import Constants from "expo-constants";

/**
 * Register this exactly, in both consoles' redirect/callback field. It cannot
 * be derived (`Linking.createURL()` varies by environment) because the
 * provider matches it character for character against what was registered.
 */
export const ANILIST_REDIRECT_URI = "nekostream://auth/anilist";
export const MAL_REDIRECT_URI = "nekostream://auth/mal";

function readExtra(key: string): string | null {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const ANILIST_CLIENT_ID = readExtra("anilistClientId");
export const MAL_CLIENT_ID = readExtra("malClientId");

/**
 * AniList gates the whole app, so a missing id is a dead end rather than a
 * degraded feature — say so in the one place the user can see it.
 */
export const ANILIST_CONFIG_ERROR = ANILIST_CLIENT_ID
  ? null
  : "This build has no AniList client id. Set extra.anilistClientId in app.json and rebuild.";

/** MAL is optional: the app works AniList-only, as it does on the web. */
export const MAL_CONFIG_ERROR = MAL_CLIENT_ID
  ? null
  : "This build has no MyAnimeList client id. Set extra.malClientId in app.json and rebuild.";
