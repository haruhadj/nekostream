import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { account } from "@/db/schema";
import { env } from "@/lib/env";

export type Provider = "anilist" | "mal";

export class TokenError extends Error {
  provider: Provider;

  constructor(provider: Provider, message: string) {
    super(message);
    this.name = "TokenError";
    this.provider = provider;
  }
}

/** Refresh a little early so a token can't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

async function loadAccount(userId: string, provider: Provider) {
  const [row] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, provider)))
    .limit(1);

  return row ?? null;
}

/**
 * MAL access tokens expire (~31 days) and must be exchanged using the stored
 * refresh token. AniList issues no refresh token, but its tokens last a year.
 */
async function refreshMalToken(accountId: string, refreshToken: string) {
  const response = await fetch("https://myanimelist.net/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MAL_CLIENT_ID,
      client_secret: env.MAL_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new TokenError(
      "mal",
      "MyAnimeList rejected the refresh token. Link the account again."
    );
  }

  const tokens = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const accessTokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;

  await db
    .update(account)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      accessTokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(account.id, accountId));

  return tokens.access_token;
}

/**
 * Returns a token that is valid right now, refreshing first when needed.
 * Throws rather than returning null so callers surface a clear reason.
 */
export async function getValidAccessToken(
  userId: string,
  provider: Provider
): Promise<string> {
  const row = await loadAccount(userId, provider);

  if (!row?.accessToken) {
    throw new TokenError(
      provider,
      provider === "mal"
        ? "MyAnimeList is not linked."
        : "AniList is not connected."
    );
  }

  const expiresAt = row.accessTokenExpiresAt?.getTime() ?? null;
  const isExpired = expiresAt !== null && expiresAt - EXPIRY_SKEW_MS <= Date.now();

  if (!isExpired) return row.accessToken;

  if (provider === "mal" && row.refreshToken) {
    return refreshMalToken(row.id, row.refreshToken);
  }

  throw new TokenError(
    provider,
    `The ${provider === "mal" ? "MyAnimeList" : "AniList"} session expired. Sign in again.`
  );
}

export async function isLinked(userId: string, provider: Provider) {
  return (await loadAccount(userId, provider)) !== null;
}
