/**
 * Pins the route-level contracts that the shared middleware/helpers must keep:
 * who gets rejected, with which status, and with which message.
 *
 * Hono apps are callable directly via `app.request()`, so no server is started.
 */

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { stubDb } from "../lib/test-support/db-stub.ts";

import { AniListError } from "../lib/anilist/client.ts";
import { MalError } from "../lib/mal/client.ts";
import { TokenError } from "../lib/tokens.ts";

const AUTH = new URL("../lib/auth.ts", import.meta.url).href;
const DB = new URL("../db/index.ts", import.meta.url).href;
const TOKENS = new URL("../lib/tokens.ts", import.meta.url).href;
const TRACKER = new URL("../lib/sync/tracker-entry.ts", import.meta.url).href;

const ENTRY = {
  id: "entry-1",
  userId: "user-1",
  anilistMediaId: 21,
  malMediaId: 5114,
  progress: 3,
};

type Options = {
  /** null models a signed-out request. */
  session?: { user: { id: string } } | null;
  rows?: unknown[];
  /** Thrown by every tracker read/write, to exercise the error mapping. */
  trackerThrows?: unknown;
};

/**
 * Per-test state the mocks read at call time.
 *
 * The mocks are registered exactly once. Re-registering them per test does not
 * work: a module is evaluated on first import and then cached, so a later
 * mock.module for the same URL never takes effect and every test after the
 * first silently reuses the first one's stubs.
 */
let state: Required<Options> = {
  session: null,
  rows: [],
  trackerThrows: undefined,
};

let registered = false;

function registerMocks() {
  if (registered) return;
  registered = true;

  mock.module(AUTH, {
    namedExports: {
      auth: { api: { getSession: () => Promise.resolve(state.session) } },
    },
  });

  // A fresh result queue per test, since a query builder is consumed as it runs.
  mock.module(DB, {
    namedExports: {
      db: new Proxy({} as Record<string, unknown>, {
        get: (_t, property) =>
          (stubDb(state.rows).db as Record<string | symbol, unknown>)[property],
      }),
    },
  });

  // Only the database-backed token lookup is replaced; TokenError itself is
  // the real class, so the route's `instanceof` checks are the real ones.
  mock.module(TOKENS, {
    namedExports: {
      TokenError,
      getValidAccessToken: () => Promise.resolve("token"),
    },
  });

  const reject = () =>
    state.trackerThrows
      ? Promise.reject(state.trackerThrows)
      : Promise.resolve({});

  mock.module(TRACKER, {
    namedExports: {
      readAniListEntry: reject,
      readMalEntry: reject,
      writeAniListEntry: reject,
      writeMalEntry: reject,
      deleteAniListEntry: reject,
      deleteMalEntry: reject,
    },
  });
}

async function loadRoutes({
  session = { user: { id: "user-1" } },
  rows = [],
  trackerThrows,
}: Options = {}) {
  state = { session, rows, trackerThrows };
  registerMocks();

  const module = await import(
    `./library-routes.ts?t=${Date.now()}${Math.random()}`
  );
  return module.libraryRoutes as { request: typeof fetch };
}

const VALID_TRACKER_BODY = JSON.stringify({
  progress: 4,
  status: "watching",
  score: 7,
});

function put(body: string) {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  };
}

test("a signed-out request is rejected before any handler runs", async () => {
  const routes = await loadRoutes({ session: null });

  try {
    const response = await routes.request("/");

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Sign in with AniList first.",
    });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("an id belonging to another account reads as absent, not forbidden", async () => {
  // The scoped lookup returns no rows, which is what another user's id yields.
  const routes = await loadRoutes({ rows: [[]] });

  try {
    const response = await routes.request("/entry-1/tracker/anilist");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not in your library." });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("an unrecognised tracker name is a 404", async () => {
  const routes = await loadRoutes({ rows: [[ENTRY]] });

  try {
    const response = await routes.request("/entry-1/tracker/kitsu");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Unknown tracker." });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("a MyAnimeList read on a title with no MAL id is a 404", async () => {
  const routes = await loadRoutes({ rows: [[{ ...ENTRY, malMediaId: null }]] });

  try {
    const response = await routes.request("/entry-1/tracker/mal");

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "This title has no MyAnimeList entry.",
    });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("an invalid tracker body is a 400 carrying the validation issues", async () => {
  const routes = await loadRoutes({ rows: [[ENTRY]] });

  try {
    const response = await routes.request(
      "/entry-1/tracker/anilist",
      put(JSON.stringify({ progress: -1, status: "watching", score: 7 }))
    );

    assert.equal(response.status, 400);

    const body = (await response.json()) as {
      error: string;
      issues: unknown[];
    };
    assert.equal(body.error, "Invalid values.");
    assert.ok(body.issues.length > 0);
  } finally {
    state.trackerThrows = undefined;
  }
});

test("a malformed JSON body is a 400 rather than a crash", async () => {
  const routes = await loadRoutes({ rows: [[ENTRY]] });

  try {
    const response = await routes.request(
      "/entry-1/tracker/anilist",
      put("not json at all")
    );

    assert.equal(response.status, 400);
  } finally {
    state.trackerThrows = undefined;
  }
});

test("an expired tracker token becomes a 401 the client can act on", async () => {
  const routes = await loadRoutes({
    rows: [[ENTRY]],
    trackerThrows: new TokenError("anilist", "Reconnect your AniList account."),
  });

  try {
    const response = await routes.request(
      "/entry-1/tracker/anilist",
      put(VALID_TRACKER_BODY)
    );

    assert.equal(response.status, 401);
    // The provider is the actionable part: it says which account to relink.
    assert.deepEqual(await response.json(), {
      error: "Reconnect your AniList account.",
      provider: "anilist",
    });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("a MyAnimeList outage becomes a 502, not a 500", async () => {
  const routes = await loadRoutes({
    rows: [[ENTRY]],
    trackerThrows: new MalError(503, "MyAnimeList returned 503"),
  });

  try {
    const response = await routes.request(
      "/entry-1/tracker/mal",
      put(VALID_TRACKER_BODY)
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: "MyAnimeList returned 503",
    });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("an AniList outage becomes a 502", async () => {
  const routes = await loadRoutes({
    rows: [[ENTRY]],
    trackerThrows: new AniListError("AniList returned 500.", { status: 500 }),
  });

  try {
    const response = await routes.request(
      "/entry-1/tracker/anilist",
      put(VALID_TRACKER_BODY)
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "AniList returned 500." });
  } finally {
    state.trackerThrows = undefined;
  }
});

test("an unexpected error is not swallowed into a tracker status", async () => {
  const routes = await loadRoutes({
    rows: [[ENTRY]],
    trackerThrows: new TypeError("undefined is not a function"),
  });

  try {
    const response = await routes.request(
      "/entry-1/tracker/anilist",
      put(VALID_TRACKER_BODY)
    );

    // Rethrown, so Hono's own handler turns it into a 500.
    assert.equal(response.status, 500);
  } finally {
    state.trackerThrows = undefined;
  }
});
