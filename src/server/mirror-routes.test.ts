/**
 * Pins the mirror apply path.
 *
 * Like the episode-tick path, a mirror write carries progress and status only.
 * Score is deliberately absent: the user is reconciling two lists, not rating
 * anything, and sending a score here would overwrite ratings on the losing
 * side. The wire-format assertions below guard that.
 */

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { stubDb } from "../lib/test-support/db-stub.ts";
import { stubFetch } from "../lib/test-support/fetch-stub.ts";

const AUTH = new URL("../lib/auth.ts", import.meta.url).href;
const DB = new URL("../db/index.ts", import.meta.url).href;
const TOKENS = new URL("../lib/tokens.ts", import.meta.url).href;
const ANILIST_QUERIES = new URL("../lib/anilist/queries.ts", import.meta.url)
  .href;
const MAL_QUERIES = new URL("../lib/mal/queries.ts", import.meta.url).href;

class TokenError extends Error {
  provider: string;
  constructor(message: string, provider = "mal") {
    super(message);
    this.provider = provider;
  }
}
/** One anime, further along on AniList than on MyAnimeList. */
const ANILIST_ENTRY = {
  media: {
    id: 21,
    idMal: 5114,
    title: { romaji: "Test Show", english: null },
    episodes: 12,
  },
  progress: 8,
  status: "CURRENT",
  updatedAt: 1_700_000_000,
};

const MAL_ENTRY = {
  malMediaId: 5114,
  title: "Test Show",
  progress: 2,
  status: "watching",
  isRewatching: false,
  updatedAt: new Date("2026-01-01"),
};

type Options = {
  session?: { user: { id: string } } | null;
  tokenError?: unknown;
};

async function loadRoutes({
  session = { user: { id: "user-1" } },
  tokenError,
}: Options = {}) {
  mock.module(AUTH, {
    namedExports: {
      auth: { api: { getSession: () => Promise.resolve(session) } },
    },
  });

  mock.module(DB, { namedExports: { db: stubDb().db } });

  mock.module(TOKENS, {
    namedExports: {
      TokenError,
      getValidAccessToken: (_userId: string, provider: string) =>
        tokenError
          ? Promise.reject(tokenError)
          : Promise.resolve(`${provider}-token`),
    },
  });

  mock.module(ANILIST_QUERIES, {
    namedExports: { viewerLibrary: () => Promise.resolve([ANILIST_ENTRY]) },
  });

  // Only the list read is stubbed; the write path exercises the real
  // MyAnimeList client so the wire format below is the genuine one.
  mock.module(MAL_QUERIES, {
    namedExports: { viewerMalList: () => Promise.resolve([MAL_ENTRY]) },
  });

  const module = await import(
    `./mirror-routes.ts?t=${Date.now()}${Math.random()}`
  );
  return module.mirrorRoutes as { request: typeof fetch };
}

function postApply(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

test("a signed-out request cannot reach the mirror", async () => {
  const routes = await loadRoutes({ session: null });

  try {
    const response = await routes.request("/");

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Sign in with AniList first.",
    });
  } finally {
    mock.reset();
  }
});

test("the dry run reports the disagreement without writing anything", async () => {
  const routes = await loadRoutes();
  const fetch = stubFetch();

  try {
    const response = await routes.request("/");

    assert.equal(response.status, 200);

    const plan = (await response.json()) as {
      rows: { key: string; suggestion: string; differences: string[] }[];
      inSyncCount: number;
    };

    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].key, "mal:5114");
    // AniList is further along, so it wins the suggestion.
    assert.equal(plan.rows[0].suggestion, "anilist");
    assert.deepEqual(plan.rows[0].differences, ["progress"]);

    assert.equal(fetch.calls.length, 0, "a dry run must not write");
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("a mirror write carries progress and status but never a score", async () => {
  const routes = await loadRoutes();
  const fetch = stubFetch();

  try {
    const response = await routes.request(
      "/apply",
      postApply({ decisions: [{ key: "mal:5114", side: "anilist" }] })
    );

    assert.equal(response.status, 200);

    const call = fetch.only();
    assert.equal(
      call.url,
      "https://api.myanimelist.net/v2/anime/5114/my_list_status"
    );
    assert.equal(call.method, "PATCH");
    assert.deepEqual(fetch.form(), {
      num_watched_episodes: "8",
      status: "watching",
      is_rewatching: "false",
    });
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("an unknown decision key is ignored rather than erroring", async () => {
  const routes = await loadRoutes();
  const fetch = stubFetch();

  try {
    const response = await routes.request(
      "/apply",
      postApply({ decisions: [{ key: "mal:99999", side: "anilist" }] })
    );

    assert.equal(response.status, 200);
    assert.equal(fetch.calls.length, 0);
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("an empty decision list is rejected as a 400", async () => {
  const routes = await loadRoutes();

  try {
    const response = await routes.request(
      "/apply",
      postApply({ decisions: [] })
    );

    assert.equal(response.status, 400);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "Invalid decisions."
    );
  } finally {
    mock.reset();
  }
});

test("a token failure reports which provider needs relinking", async () => {
  const routes = await loadRoutes({
    tokenError: new TokenError("Reconnect your MyAnimeList account.", "mal"),
  });

  try {
    const response = await routes.request("/");

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Reconnect your MyAnimeList account.",
      provider: "mal",
    });
  } finally {
    mock.reset();
  }
});
