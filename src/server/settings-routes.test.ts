/**
 * Pins the /api/settings contract a mobile client (and the settings/mirror/
 * detail pages) relies on: which trackers are linked and when AniList last
 * synced, on both GET and PATCH so the client can treat one response type
 * for both. See planning/PLAN.md Phase 1a.
 */

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { stubDb } from "../lib/test-support/db-stub.ts";

const AUTH = new URL("../lib/auth.ts", import.meta.url).href;
const DB = new URL("../db/index.ts", import.meta.url).href;

type Options = {
  /** null models a signed-out request. */
  session?: { user: { id: string } } | null;
  rows?: unknown[];
};

/**
 * Per-test state the mocks read at call time. Registered exactly once: a
 * module is evaluated on first import and then cached, so a later
 * mock.module for the same URL never takes effect — see
 * server/library-routes.test.ts for the same pattern.
 *
 * Unlike that file's handlers (one db query per request), the settings
 * routes run several sequential queries per request, so the stub instance
 * itself — not just its row queue — has to survive across the whole
 * request: a fresh `stubDb(...)` per property access would reset the
 * "how many queries answered so far" counter on every `db.xxx()` call.
 */
let state: Required<Options> = { session: null, rows: [] };
let currentDb: unknown = stubDb(state.rows).db;
let registered = false;

function registerMocks() {
  if (registered) return;
  registered = true;

  mock.module(AUTH, {
    namedExports: {
      auth: { api: { getSession: () => Promise.resolve(state.session) } },
    },
  });

  mock.module(DB, {
    namedExports: {
      db: new Proxy({} as Record<string, unknown>, {
        get: (_t, property) =>
          (currentDb as Record<string | symbol, unknown>)[property],
      }),
    },
  });
}

async function loadRoutes({
  session = { user: { id: "user-1" } },
  rows = [],
}: Options = {}) {
  state = { session, rows };
  currentDb = stubDb(rows).db;
  registerMocks();

  const module = await import(
    `./settings-routes.ts?t=${Date.now()}${Math.random()}`
  );
  return module.settingsRoutes as { request: typeof fetch };
}

function patch(body: string) {
  return {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  };
}

test("a signed-out request is rejected before any handler runs", async () => {
  const routes = await loadRoutes({ session: null });

  const response = await routes.request("/");

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Sign in with AniList first.",
  });
});

test("GET reports both trackers linked and the last AniList sync time", async () => {
  const syncedAt = new Date("2026-08-01T00:00:00.000Z");
  const routes = await loadRoutes({
    rows: [
      // db.select(...).from(user)...
      [
        {
          notificationEmail: null,
          notifyNewEpisodesByEmail: false,
          anilistSyncedAt: syncedAt,
        },
      ],
      // linkedProviders: db.select(...).from(account)...
      [{ providerId: "anilist" }, { providerId: "mal" }],
    ],
  });

  const response = await routes.request("/");
  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.anilistLinked, true);
  assert.equal(body.malLinked, true);
  assert.equal(body.anilistSyncedAt, syncedAt.toISOString());
});

test("GET reports an unlinked tracker and a never-synced account as false/null", async () => {
  const routes = await loadRoutes({
    rows: [
      [
        {
          notificationEmail: null,
          notifyNewEpisodesByEmail: false,
          anilistSyncedAt: null,
        },
      ],
      [], // no linked accounts at all
    ],
  });

  const response = await routes.request("/");
  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(body.anilistLinked, false);
  assert.equal(body.malLinked, false);
  assert.equal(body.anilistSyncedAt, null);
});

test("PATCH returns the same link-status fields GET does", async () => {
  const routes = await loadRoutes({
    rows: [
      // current select
      [{ notificationEmail: null, notifyNewEpisodesByEmail: false }],
      // update().returning()
      [
        {
          notificationEmail: "me@example.com",
          notifyNewEpisodesByEmail: true,
          anilistSyncedAt: null,
        },
      ],
      // linkedProviders
      [{ providerId: "anilist" }],
    ],
  });

  const response = await routes.request(
    "/",
    patch(
      JSON.stringify({
        notificationEmail: "me@example.com",
        notifyNewEpisodesByEmail: true,
      })
    )
  );
  const body = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.anilistLinked, true);
  assert.equal(body.malLinked, false);
  assert.equal(body.anilistSyncedAt, null);
});
