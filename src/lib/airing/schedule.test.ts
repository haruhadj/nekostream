import assert from "node:assert/strict";
import { test } from "node:test";

import {
  backoffMs,
  DORMANT,
  firstCheckAt,
  GIVE_UP_MS,
  isExhausted,
  MAX_BACKOFF_MS,
  nextPollAt,
  RELEASE_LAG_MS,
  stateAfterCheck,
  stateForAiring,
} from "./schedule.ts";

const AIRED = new Date("2026-08-01T15:00:00Z");
const minutes = (n: number) => n * 60_000;

test("the first check waits for the encode-and-upload lag", () => {
  assert.equal(
    firstCheckAt(AIRED).getTime() - AIRED.getTime(),
    RELEASE_LAG_MS
  );
  assert.deepEqual(nextPollAt({ airingAt: AIRED, attempts: 0 }), firstCheckAt(AIRED));
});

test("backoff doubles and then stops at the cap", () => {
  assert.equal(backoffMs(0), RELEASE_LAG_MS);
  assert.equal(backoffMs(1), RELEASE_LAG_MS * 2);
  assert.equal(backoffMs(2), RELEASE_LAG_MS * 4);
  assert.equal(backoffMs(99), MAX_BACKOFF_MS);
});

test("checks spread out instead of repeating at a fixed interval", () => {
  const offsets = [0, 1, 2, 3, 4].map(
    (attempts) =>
      (nextPollAt({ airingAt: AIRED, attempts }).getTime() - AIRED.getTime()) /
      60_000
  );

  assert.deepEqual(offsets, [20, 40, 80, 160, 280]);
});

test("a few checks cover the window a group realistically uploads in", () => {
  // Four requests reach past three hours after air time; that is the whole
  // point of the backoff versus polling every minute.
  assert.ok(
    nextPollAt({ airingAt: AIRED, attempts: 4 }).getTime() - AIRED.getTime() >
      minutes(180)
  );
});

test("we give up only after the full grace period", () => {
  const almost = new Date(AIRED.getTime() + GIVE_UP_MS - 1);
  const past = new Date(AIRED.getTime() + GIVE_UP_MS + 1);

  assert.equal(isExhausted({ airingAt: AIRED, now: almost }), false);
  assert.equal(isExhausted({ airingAt: AIRED, now: past }), true);
});

test("finding the episode stops all further polling", () => {
  const state = stateAfterCheck({
    airingAt: AIRED,
    targetEpisode: 8,
    attempts: 2,
    found: true,
    now: new Date(AIRED.getTime() + minutes(90)),
  });

  assert.deepEqual(state, DORMANT);
  assert.equal(state.nextAt, null);
});

test("an empty check schedules one more, further out", () => {
  const state = stateAfterCheck({
    airingAt: AIRED,
    targetEpisode: 8,
    attempts: 1,
    found: false,
    now: new Date(AIRED.getTime() + minutes(40)),
  });

  assert.equal(state.targetEpisode, 8);
  assert.equal(state.attempts, 2);
  assert.deepEqual(state.nextAt, nextPollAt({ airingAt: AIRED, attempts: 2 }));
});

test("an empty check past the grace period goes dormant rather than retrying", () => {
  const state = stateAfterCheck({
    airingAt: AIRED,
    targetEpisode: 8,
    attempts: 7,
    found: false,
    now: new Date(AIRED.getTime() + GIVE_UP_MS + minutes(1)),
  });

  assert.deepEqual(state, DORMANT);
});

test("a newly announced episode arms the feed", () => {
  const state = stateForAiring({
    airingAt: AIRED,
    episode: 9,
    current: { targetEpisode: 8 },
  });

  assert.deepEqual(state, {
    targetEpisode: 9,
    attempts: 0,
    nextAt: firstCheckAt(AIRED),
  });
});

test("re-syncing the same episode does not reset a backoff in progress", () => {
  assert.equal(
    stateForAiring({ airingAt: AIRED, episode: 8, current: { targetEpisode: 8 } }),
    null
  );
});

test("a show that finished airing stands down, and stays stood down", () => {
  assert.deepEqual(
    stateForAiring({ airingAt: null, episode: null, current: { targetEpisode: 8 } }),
    DORMANT
  );
  assert.equal(
    stateForAiring({
      airingAt: null,
      episode: null,
      current: { targetEpisode: null },
    }),
    null
  );
});
