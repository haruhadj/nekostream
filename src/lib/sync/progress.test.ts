/**
 * Pins the dual-tracker push that happens when an episode is marked watched.
 *
 * The subtle contract here is that this path writes *only* progress and status.
 * The tracker-editor path writes score as well, and folding the two together
 * naively would send score 0 on every episode tick and silently wipe the user's
 * ratings. The score assertions below are the guard against that.
 */

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { stubFetch } from "../test-support/fetch-stub.ts";
import type { SyncTarget } from "./progress.ts";

const TOKENS_MODULE = new URL("../tokens.ts", import.meta.url).href;

/** Loads progress.ts with token lookup stubbed, since real lookup hits the db. */
async function loadSyncProgress(
  tokenFor: (provider: string) => Promise<string> = (p) =>
    Promise.resolve(`${p}-token`)
) {
  class TokenError extends Error {}

  mock.module(TOKENS_MODULE, {
    namedExports: {
      TokenError,
      getValidAccessToken: (_userId: string, provider: string) =>
        tokenFor(provider),
    },
  });

  const module = await import(`./progress.ts?t=${Date.now()}${Math.random()}`);
  return module.syncProgress as typeof import("./progress.ts").syncProgress;
}

const TARGET: SyncTarget = {
  userId: "user-1",
  anilistMediaId: 21,
  malMediaId: 5114,
  totalEpisodes: 12,
  syncAnilist: true,
  syncMal: true,
};

test("pushes progress to both trackers and reports both as ok", async () => {
  const syncProgress = await loadSyncProgress();
  const fetch = stubFetch([
    { json: { data: { SaveMediaListEntry: { id: 1 } } } },
    { json: {} },
  ]);

  try {
    const outcomes = await syncProgress(TARGET, 5);

    assert.deepEqual(outcomes, [
      { provider: "anilist", ok: true },
      { provider: "mal", ok: true },
    ]);
    assert.equal(fetch.calls.length, 2);
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("an episode tick never sends a score to either tracker", async () => {
  const syncProgress = await loadSyncProgress();
  const fetch = stubFetch([
    { json: { data: { SaveMediaListEntry: { id: 1 } } } },
    { json: {} },
  ]);

  try {
    await syncProgress(TARGET, 5);

    const anilistVariables = fetch.graphql(0).variables;
    assert.deepEqual(anilistVariables, {
      mediaId: 21,
      progress: 5,
      status: "CURRENT",
    });
    assert.ok(!("score" in anilistVariables));
    assert.ok(!("scoreRaw" in anilistVariables));

    assert.deepEqual(fetch.form(1), {
      num_watched_episodes: "5",
      status: "watching",
    });
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("reaching the final episode pushes the completed status", async () => {
  const syncProgress = await loadSyncProgress();
  const fetch = stubFetch([
    { json: { data: { SaveMediaListEntry: { id: 1 } } } },
    { json: {} },
  ]);

  try {
    await syncProgress(TARGET, 12);

    assert.equal(fetch.graphql(0).variables.status, "COMPLETED");
    assert.equal(fetch.form(1).status, "completed");
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("a title with no MyAnimeList id is skipped rather than failed", async () => {
  const syncProgress = await loadSyncProgress();
  const fetch = stubFetch([
    { json: { data: { SaveMediaListEntry: { id: 1 } } } },
  ]);

  try {
    const outcomes = await syncProgress({ ...TARGET, malMediaId: null }, 3);

    assert.deepEqual(outcomes, [
      { provider: "anilist", ok: true },
      {
        provider: "mal",
        ok: true,
        skipped: true,
        reason: "This title has no MyAnimeList entry.",
      },
    ]);
    // Only AniList was contacted.
    assert.equal(fetch.calls.length, 1);
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("disabled trackers are not contacted at all", async () => {
  const syncProgress = await loadSyncProgress();
  const fetch = stubFetch([{ json: {} }]);

  try {
    const outcomes = await syncProgress({ ...TARGET, syncAnilist: false }, 3);

    assert.deepEqual(outcomes, [{ provider: "mal", ok: true }]);
    assert.match(fetch.only().url, /myanimelist/);
  } finally {
    fetch.restore();
    mock.reset();
  }
});

test("one tracker failing never blocks the other", async () => {
  const syncProgress = await loadSyncProgress();
  const fetch = stubFetch([
    { json: { data: { SaveMediaListEntry: { id: 1 } } } },
    { status: 500, text: "boom" },
  ]);

  try {
    const outcomes = await syncProgress(TARGET, 5);

    assert.deepEqual(outcomes[0], { provider: "anilist", ok: true });
    assert.equal(outcomes[1].provider, "mal");
    assert.equal(outcomes[1].ok, false);
  } finally {
    fetch.restore();
    mock.reset();
  }
});
