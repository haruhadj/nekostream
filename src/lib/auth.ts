import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";

import { db, schema } from "@/db";
import { env } from "@/lib/env";

/** AniList exposes no REST userinfo endpoint — identity comes from a GraphQL Viewer query. */
async function fetchAniListUser(accessToken: string) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: `query { Viewer { id name avatar { large } } }`,
    }),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    data?: {
      Viewer?: {
        id: number;
        name: string;
        avatar?: { large?: string | null } | null;
      } | null;
    };
  };

  const viewer = json.data?.Viewer;
  if (!viewer) return null;

  return {
    id: String(viewer.id),
    name: viewer.name,
    // AniList never returns an email; synthesize a stable placeholder so the
    // user row satisfies the not-null unique email column.
    email: `${viewer.id}@anilist.local`,
    emailVerified: false,
    image: viewer.avatar?.large ?? undefined,
  };
}

async function fetchMalUser(accessToken: string) {
  const res = await fetch("https://api.myanimelist.net/v2/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const profile = (await res.json()) as {
    id: number;
    name: string;
    picture?: string | null;
  };

  return {
    id: String(profile.id),
    name: profile.name,
    email: `${profile.id}@myanimelist.local`,
    emailVerified: false,
    image: profile.picture ?? undefined,
  };
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  /**
   * The app is typically reachable on two addresses — a LAN one and the public
   * https hostname — but only baseURL can own the OAuth redirect. Listing both
   * keeps requests arriving on the other one from failing the origin check;
   * sign-in still always round-trips through baseURL, since a session cookie
   * set on one origin is never sent to the other.
   */
  trustedOrigins: [env.BETTER_AUTH_URL, env.PUBLIC_URL].filter(
    (origin): origin is string => Boolean(origin)
  ),
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: false },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["anilist", "mal"],
      // Neither provider returns a real email, so the two synthesized
      // placeholders never match. Without this, linking MAL to an AniList
      // account is rejected and a second, empty user is created instead.
      allowDifferentEmails: true,
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "anilist",
          clientId: env.ANILIST_CLIENT_ID,
          clientSecret: env.ANILIST_CLIENT_SECRET,
          authorizationUrl: "https://anilist.co/api/v2/oauth/authorize",
          tokenUrl: "https://anilist.co/api/v2/oauth/token",
          // AniList issues no refresh token and does not support PKCE; its
          // access tokens are long-lived (1 year).
          pkce: false,
          getUserInfo: async (tokens) =>
            tokens.accessToken ? fetchAniListUser(tokens.accessToken) : null,
        },
        {
          providerId: "mal",
          clientId: env.MAL_CLIENT_ID,
          clientSecret: env.MAL_CLIENT_SECRET,
          authorizationUrl: "https://myanimelist.net/v1/oauth2/authorize",
          tokenUrl: "https://myanimelist.net/v1/oauth2/token",
          // MAL mandates PKCE but only implements the "plain" method, while
          // better-auth's built-in PKCE always sends S256. So PKCE is driven
          // manually here: challenge == verifier, supplied from env.
          pkce: false,
          authorizationUrlParams: {
            code_challenge: env.MAL_CODE_VERIFIER,
            code_challenge_method: "plain",
          },
          tokenUrlParams: {
            code_verifier: env.MAL_CODE_VERIFIER,
          },
          getUserInfo: async (tokens) =>
            tokens.accessToken ? fetchMalUser(tokens.accessToken) : null,
        },
      ],
    }),
  ],
});
