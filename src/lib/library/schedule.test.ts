/**
 * Pins the `/schedule` page and `GET /api/library/schedule` route's shared
 * query helper: the `hasFeed` derivation off the left-joined `rssFilter`,
 * and the `Date` -> ISO string boundary. The `nextAiringAt IS NULL` filter
 * itself is enforced by the SQL `where` clause, not app code, so it isn't
 * re-verified here against a stub that doesn't execute SQL — these rows
 * model exactly what that filter guarantees the real query already returns.
 */

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { stubDb } from "../test-support/db-stub.ts";

const DB = new URL("../../db/index.ts", import.meta.url).href;

/**
 * A fresh result queue per test, read by the mock at call time. Registered
 * exactly once: a module is evaluated on first import and then cached, so a
 * later mock.module for the same URL never takes effect (node:test throws
 * ERR_INVALID_STATE) — see server/library-routes.test.ts for the same pattern.
 */
let rows: unknown[] = [];
let registered = false;

function registerMocks() {
  if (registered) return;
  registered = true;

  mock.module(DB, {
    namedExports: {
      db: new Proxy({} as Record<string, unknown>, {
        get: (_t, property) =>
          (stubDb(rows).db as Record<string | symbol, unknown>)[property],
      }),
    },
  });
}

async function loadGetScheduleEntries(queuedRows: unknown[]) {
  rows = queuedRows;
  registerMocks();

  const module = await import(`./schedule.ts?t=${Date.now()}${Math.random()}`);
  return module.getScheduleEntries as typeof import("./schedule.ts").getScheduleEntries;
}

test("a feed-having entry reports hasFeed true", async () => {
  const getScheduleEntries = await loadGetScheduleEntries([
    [
      {
        id: "entry-1",
        titleRomaji: "Test Show",
        titleEnglish: null,
        coverImageUrl: null,
        nextAiringAt: new Date("2026-08-28T12:00:00.000Z"),
        nextAiringEpisode: 5,
        progress: 4,
        totalEpisodes: 12,
        hasFeed: "filter-1", // the joined rssFilter.id
      },
    ],
  ]);

  const entries = await getScheduleEntries("user-1");

  assert.equal(entries.length, 1);
  assert.equal(entries[0].hasFeed, true);
  assert.equal(entries[0].nextAiringAt, "2026-08-28T12:00:00.000Z");
  assert.equal(entries[0].nextAiringEpisode, 5);
});

test("an entry with no saved feed reports hasFeed false", async () => {
  const getScheduleEntries = await loadGetScheduleEntries([
    [
      {
        id: "entry-2",
        titleRomaji: "Untracked Show",
        titleEnglish: null,
        coverImageUrl: null,
        nextAiringAt: new Date("2026-08-29T00:00:00.000Z"),
        nextAiringEpisode: 1,
        progress: 0,
        totalEpisodes: null,
        hasFeed: null, // no matching rssFilter row
      },
    ],
  ]);

  const entries = await getScheduleEntries("user-1");

  assert.equal(entries[0].hasFeed, false);
});

test("no entries with an upcoming episode yields an empty list", async () => {
  const getScheduleEntries = await loadGetScheduleEntries([[]]);

  const entries = await getScheduleEntries("user-1");

  assert.deepEqual(entries, []);
});
