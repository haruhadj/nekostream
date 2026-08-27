/**
 * The browser round trip both trackers share — deliberately without
 * `expo-auth-session`.
 *
 * The plan named that library, and it was installed and then removed once its
 * source was read: `AuthRequest` hard-refuses the one thing MyAnimeList
 * requires —
 *
 *   invariant(this.codeChallengeMethod !== CodeChallengeMethod.Plain,
 *     "`AuthRequest` does not support `CodeChallengeMethod.Plain` as it's not
 *      secure.")
 *
 * — and MAL implements *only* `plain` (its own docs: "Currently, only the
 * plain method is supported"). Working around that invariant, while the
 * library also contributed nothing to AniList's implicit grant (no exchange,
 * no PKCE), left a dependency neither flow actually used. `expo-web-browser`
 * plus `expo-crypto` is what remains, and it is the whole of it.
 *
 * URL and form encoding live in `url.ts`, which imports nothing from `expo-*`
 * so it can be run and checked off-device.
 */

import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

import { parseRedirectParams } from "./url";

/**
 * RFC 7636's unreserved set — legal in a PKCE `code_verifier`, and safe in a
 * `state` without escaping.
 */
const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/** Cryptographically random, from expo-crypto — not `Math.random()`. */
export function randomString(length: number): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const byte of bytes) out += CHARSET[byte % CHARSET.length];
  return out;
}

export type AuthFlowResult =
  | { ok: true; params: Record<string, string> }
  | { ok: false; error: string; cancelled: boolean };

/**
 * Opens the provider's consent page and resolves when the `nekostream://`
 * redirect comes back.
 *
 * A dismissed browser is reported as cancelled rather than as an error: the
 * user closing the sheet is a decision, and the calling screen should go quiet
 * rather than show a failure.
 */
export async function openAuthFlow(
  authUrl: string,
  redirectUri: string
): Promise<AuthFlowResult> {
  let result: WebBrowser.WebBrowserAuthSessionResult;

  try {
    result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  } catch {
    return {
      ok: false,
      cancelled: false,
      error: "Could not open the sign-in page.",
    };
  }

  if (result.type !== "success") {
    return { ok: false, cancelled: true, error: "Sign-in was cancelled." };
  }

  const params = parseRedirectParams(result.url);

  if (params.error) {
    // OAuth's own error shape: `error` plus an optional human description.
    const detail = params.error_description ?? params.error;
    return { ok: false, cancelled: false, error: detail };
  }

  return { ok: true, params };
}
