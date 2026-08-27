/**
 * The better-auth client, built lazily.
 *
 * `createAuthClient` takes its `baseURL` at construction, and the server URL
 * is not known until the operator enters it at runtime. Building the client
 * eagerly at import time is the single most likely way to ship an app
 * permanently pointed at the wrong host (see planning/PLAN.md's risk table),
 * so it is constructed on first use and rebuilt if the URL changes.
 *
 * `@better-auth/expo`'s `expoClient` plugin:
 *  - stores the session cookie in expo-secure-store and replays it,
 *  - intercepts `/get-session`, `/sign-out`, `/link-social` and any
 *    `/sign-in/*` path — which covers genericOAuth's `/sign-in/oauth2`, so
 *    `signIn.oauth2({ providerId: "anilist" })` opens the system browser and
 *    resolves once the `nekostream://` deep link returns.
 *  - it does NOT intercept `/oauth2/link` — that is the known MAL-linking
 *    gap, handled in Phase 5.
 */

import { expoClient } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { setAuthHeadersProvider } from "@/api/client";

import { getServerUrl } from "./server-url";

/** Must match `scheme` in app.json and `MOBILE_APP_SCHEME` on the server. */
const APP_SCHEME = "nekostream";

/**
 * `@better-auth/expo@1.6.25` ships a `getActions()` typed with two params
 * where `better-auth@1.6.25`'s `BetterAuthClientPlugin` now expects three,
 * so the plugin object does not structurally satisfy the interface even
 * though the runtime contract is exactly what the official docs prescribe.
 * The cast bridges that packaged type skew and nothing more.
 */
const expoAuthPlugin = expoClient({
  scheme: APP_SCHEME,
  storagePrefix: "nekostream",
  // SecureStore's sync getItem/setItem match the storage interface the
  // plugin expects, so no adapter is needed.
  storage: SecureStore,
}) as unknown as BetterAuthClientPlugin;

function buildClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    // genericOAuthClient() is what adds `signIn.oauth2` / `oauth2.link`,
    // matching the web client (src/lib/auth-client.ts).
    plugins: [expoAuthPlugin, genericOAuthClient()],
  });
}

type AuthClient = ReturnType<typeof buildClient>;

/** `getCookie` is contributed by expoClient's getActions() (see the cast above). */
type WithGetCookie = { getCookie: () => string };

let cached: { url: string; client: AuthClient } | null = null;

/**
 * Returns the auth client for the currently-configured server, building it
 * on first call and rebuilding it if the server URL has since changed.
 * Throws if no server URL is set — the _layout.tsx gate routes to
 * server-url.tsx before any screen that calls this can mount.
 */
export function getAuthClient(): AuthClient {
  const url = getServerUrl();
  if (!url) {
    throw new Error(
      "getAuthClient() with no server URL — the _layout.tsx gate should have routed to server-url first."
    );
  }

  if (!cached || cached.url !== url) {
    const client = buildClient(url);
    cached = { url, client };
    // Wire the api client's Cookie header to this client's stored session.
    setAuthHeadersProvider(async (): Promise<Record<string, string>> => {
      const cookie = (client as unknown as WithGetCookie).getCookie();
      return cookie ? { Cookie: cookie } : {};
    });
  }

  return cached.client;
}
