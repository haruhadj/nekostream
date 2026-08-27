/**
 * MyAnimeList linking, on the device — PKCE as a public client, no secret.
 *
 * Verified against MAL's authorization reference (2026-08-27) before this was
 * written, because it is the one external claim the standalone plan rested on:
 *
 *  - `client_secret` is "OPTIONAL in Scheme 1" — credentials in the request
 *    body — and an app registered with **App Type `other`** is issued none.
 *    So the token requests below send `client_id` and no secret, and no
 *    `Authorization: Basic` header.
 *  - "Currently, only the `plain` method is supported" for PKCE. With `plain`
 *    the challenge *is* the verifier, which is why one value is sent twice.
 *
 * The server generates its verifier once, from `MAL_CODE_VERIFIER`, only
 * because better-auth's genericOAuth needed a static value. A fresh verifier
 * per attempt — what happens here — is PKCE used as intended.
 *
 * Unlike AniList, MAL tokens expire (~31 days) and do come with a refresh
 * token, so the refresh that `src/lib/tokens.ts` does on the server has to
 * happen here instead.
 */

import {
  MAL_CLIENT_ID,
  MAL_CONFIG_ERROR,
  MAL_REDIRECT_URI,
} from "./config";
import { openAuthFlow, randomString } from "./oauth";
import { buildUrl, formEncode } from "./url";
import {
  clearProfile,
  clearTokens,
  readTokens,
  saveProfile,
  saveTokens,
  type TrackerProfile,
} from "./token-store";

const AUTHORIZE_URL = "https://myanimelist.net/v1/oauth2/authorize";
const TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";
const PROFILE_URL = "https://api.myanimelist.net/v2/users/@me";

/** RFC 7636 allows 43–128 characters; MAL enforces the same range. */
const VERIFIER_LENGTH = 64;

/** Refresh a little early so a token can't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export type LinkResult =
  | { ok: true; profile: TrackerProfile }
  | { ok: false; error: string; cancelled: boolean };

export async function linkMyAnimeList(): Promise<LinkResult> {
  if (!MAL_CLIENT_ID) {
    return {
      ok: false,
      cancelled: false,
      error: MAL_CONFIG_ERROR ?? "MyAnimeList is not configured.",
    };
  }

  const codeVerifier = randomString(VERIFIER_LENGTH);
  const state = randomString(16);

  const url = buildUrl(AUTHORIZE_URL, {
    response_type: "code",
    client_id: MAL_CLIENT_ID,
    redirect_uri: MAL_REDIRECT_URI,
    // With `plain`, the challenge is the verifier verbatim.
    code_challenge: codeVerifier,
    code_challenge_method: "plain",
    state,
  });

  const flow = await openAuthFlow(url, MAL_REDIRECT_URI);
  if (!flow.ok) return flow;

  // The state check is the reason a random state is generated at all: it ties
  // this redirect to this request, and a mismatch means the redirect did not
  // come from the flow we started.
  if (flow.params.state !== state) {
    return {
      ok: false,
      cancelled: false,
      error: "MyAnimeList's response did not match this request.",
    };
  }

  const code = flow.params.code;
  if (!code) {
    return {
      ok: false,
      cancelled: false,
      error: "MyAnimeList returned no authorization code.",
    };
  }

  let tokens: TokenResponse;
  try {
    tokens = await postToken({
      client_id: MAL_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: MAL_REDIRECT_URI,
    });
  } catch {
    return {
      ok: false,
      cancelled: false,
      error: "MyAnimeList rejected the sign-in. Try again.",
    };
  }

  let profile: TrackerProfile;
  try {
    profile = await fetchMalProfile(tokens.access_token);
  } catch {
    return {
      ok: false,
      cancelled: false,
      error: "Linked, but MyAnimeList would not say who you are. Try again.",
    };
  }

  await persist(tokens, null);
  await saveProfile("mal", profile);

  return { ok: true, profile };
}

async function postToken(
  params: Record<string, string>
): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(params),
  });

  if (!response.ok) throw new Error(`MAL token endpoint ${response.status}`);

  const json = (await response.json()) as TokenResponse;
  if (!json.access_token) throw new Error("MAL returned no access token.");
  return json;
}

async function fetchMalProfile(accessToken: string): Promise<TrackerProfile> {
  const response = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`MAL profile ${response.status}`);

  const profile = (await response.json()) as {
    id: number;
    name: string;
    picture?: string | null;
  };

  return {
    id: String(profile.id),
    name: profile.name,
    avatarUrl: profile.picture ?? null,
  };
}

/** MAL sometimes omits a new refresh token; keep the old one when it does. */
async function persist(
  tokens: TokenResponse,
  previousRefreshToken: string | null
): Promise<void> {
  await saveTokens("mal", {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previousRefreshToken,
    expiresAt: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : null,
  });
}

/**
 * Guards against two screens refreshing at once — the second await joins the
 * first request instead of racing it and invalidating its own result.
 */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * A token that is valid right now, refreshing first when needed — the device
 * counterpart of `getValidAccessToken(userId, "mal")`.
 *
 * Returns null rather than throwing, because every caller's remedy is the
 * same: treat MAL as unlinked. When MAL rejects the refresh token outright the
 * stored credentials are cleared, so the Settings screen stops claiming a link
 * that no longer exists.
 */
export async function getValidMalToken(): Promise<string | null> {
  const tokens = await readTokens("mal");
  if (!tokens) return null;

  const expired =
    tokens.expiresAt !== null &&
    tokens.expiresAt - EXPIRY_SKEW_MS <= Date.now();

  if (!expired) return tokens.accessToken;
  if (!tokens.refreshToken) {
    await unlinkMyAnimeList();
    return null;
  }

  refreshInFlight ??= refresh(tokens.refreshToken).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function refresh(refreshToken: string): Promise<string | null> {
  if (!MAL_CLIENT_ID) return null;

  let tokens: TokenResponse;
  try {
    tokens = await postToken({
      client_id: MAL_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  } catch {
    // MAL has said these credentials are dead; keeping them would only make
    // the next call fail the same way.
    await unlinkMyAnimeList();
    return null;
  }

  await persist(tokens, refreshToken);
  return tokens.access_token;
}

export async function unlinkMyAnimeList(): Promise<void> {
  await clearTokens("mal");
  await clearProfile("mal");
}
