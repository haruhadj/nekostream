/**
 * AniList sign-in, on the device.
 *
 * Implicit grant (`response_type=token`): the token comes back in the
 * redirect's *fragment* and there is no exchange, so no client secret is
 * involved at any point. AniList's authorization-code grant would need one,
 * and AniList supports no PKCE — implicit is the only secret-free path it
 * offers, which is what its own docs recommend for mobile apps.
 *
 * Tokens last a year and AniList issues no refresh token, so there is nothing
 * to rotate: when it finally expires the user signs in again. That is the
 * whole lifecycle, and it is why this file is so much shorter than mal.ts.
 */

import { anilistRequest } from "@shared/anilist/client";

import {
  ANILIST_CLIENT_ID,
  ANILIST_CONFIG_ERROR,
  ANILIST_REDIRECT_URI,
} from "./config";
import { openAuthFlow } from "./oauth";
import { buildUrl } from "./url";
import {
  clearProfile,
  clearTokens,
  readTokens,
  saveProfile,
  saveTokens,
  type TrackerProfile,
} from "./token-store";

const AUTHORIZE_URL = "https://anilist.co/api/v2/oauth/authorize";

/** Refresh/re-auth a little early so a token can't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

type ViewerResponse = {
  Viewer: {
    id: number;
    name: string;
    avatar?: { large?: string | null } | null;
  } | null;
};

/** The same identity query the server runs in `lib/auth.ts`. */
const VIEWER_QUERY = `query { Viewer { id name avatar { large } } }`;

export type SignInResult =
  | { ok: true; profile: TrackerProfile }
  | { ok: false; error: string; cancelled: boolean };

export async function signInWithAniList(): Promise<SignInResult> {
  if (!ANILIST_CLIENT_ID) {
    return {
      ok: false,
      cancelled: false,
      error: ANILIST_CONFIG_ERROR ?? "AniList is not configured.",
    };
  }

  // No `redirect_uri` parameter: AniList's implicit grant uses the URI
  // registered against the client, and its docs' example omits it.
  const url = buildUrl(AUTHORIZE_URL, {
    client_id: ANILIST_CLIENT_ID,
    response_type: "token",
  });

  const flow = await openAuthFlow(url, ANILIST_REDIRECT_URI);
  if (!flow.ok) return flow;

  const accessToken = flow.params.access_token;
  if (!accessToken) {
    return {
      ok: false,
      cancelled: false,
      error: "AniList returned no access token.",
    };
  }

  const expiresIn = Number(flow.params.expires_in);
  const expiresAt = Number.isFinite(expiresIn)
    ? Date.now() + expiresIn * 1000
    : null;

  let profile: TrackerProfile;
  try {
    profile = await fetchViewer(accessToken);
  } catch {
    return {
      ok: false,
      cancelled: false,
      error: "Signed in, but AniList would not say who you are. Try again.",
    };
  }

  await saveTokens("anilist", { accessToken, refreshToken: null, expiresAt });
  await saveProfile("anilist", profile);

  return { ok: true, profile };
}

async function fetchViewer(accessToken: string): Promise<TrackerProfile> {
  const data = await anilistRequest<ViewerResponse>(
    VIEWER_QUERY,
    {},
    { accessToken }
  );

  const viewer = data.Viewer;
  if (!viewer) throw new Error("AniList returned no viewer.");

  return {
    id: String(viewer.id),
    name: viewer.name,
    avatarUrl: viewer.avatar?.large ?? null,
  };
}

/**
 * The access token if there is a usable one, null otherwise — the device
 * counterpart of `getValidAccessToken(userId, "anilist")`. Null means "send
 * the user back to sign-in", which for AniList is the only remedy.
 */
export async function getAniListToken(): Promise<string | null> {
  const tokens = await readTokens("anilist");
  if (!tokens) return null;

  if (
    tokens.expiresAt !== null &&
    tokens.expiresAt - EXPIRY_SKEW_MS <= Date.now()
  ) {
    return null;
  }

  return tokens.accessToken;
}

export async function signOutOfAniList(): Promise<void> {
  await clearTokens("anilist");
  await clearProfile("anilist");
}
