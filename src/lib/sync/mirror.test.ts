import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMirrorPlan,
  fromAniListStatus,
  fromMalStatus,
  type AniListItem,
  type MalItem,
} from "./mirror.ts";

function ani(overrides: Partial<AniListItem> = {}): AniListItem {
  return {
    anilistMediaId: 1,
    malMediaId: 100,
    title: "Show",
    totalEpisodes: 12,
    progress: 5,
    status: "watching",
    updatedAt: null,
    ...overrides,
  };
}

function mal(overrides: Partial<MalItem> = {}): MalItem {
  return {
    malMediaId: 100,
    title: "Show",
    progress: 5,
    status: "watching",
    updatedAt: null,
    ...overrides,
  };
}

test("entries that agree are counted, not surfaced for a decision", () => {
  const plan = buildMirrorPlan([ani()], [mal()]);

  assert.equal(plan.inSyncCount, 1);
  assert.equal(plan.rows.length, 0);
});

test("differing progress and status are both reported", () => {
  const plan = buildMirrorPlan(
    [ani({ progress: 7, status: "completed" })],
    [mal({ progress: 5, status: "watching" })]
  );

  assert.equal(plan.rows.length, 1);
  assert.deepEqual(plan.rows[0].differences, ["progress", "status"]);
});

test("rewatching on MAL maps to AniList's repeating", () => {
  assert.equal(fromMalStatus("watching", true), "repeating");
  assert.equal(fromMalStatus("watching", false), "watching");
  assert.equal(fromMalStatus("on_hold", false), "paused");
  assert.equal(fromAniListStatus("REPEATING"), "repeating");
  assert.equal(fromAniListStatus("PAUSED"), "paused");
});

test("unknown statuses become null rather than a wrong guess", () => {
  assert.equal(fromAniListStatus("SOMETHING_NEW"), null);
  assert.equal(fromAniListStatus(null), null);
  assert.equal(fromMalStatus("something_new", false), null);
});

test("suggests the side with more episodes watched", () => {
  const higherOnMal = buildMirrorPlan(
    [ani({ progress: 2 })],
    [mal({ progress: 9 })]
  );
  assert.equal(higherOnMal.rows[0].suggestion, "mal");

  const higherOnAniList = buildMirrorPlan(
    [ani({ progress: 9 })],
    [mal({ progress: 2 })]
  );
  assert.equal(higherOnAniList.rows[0].suggestion, "anilist");
});

test("equal progress falls back to whichever was touched more recently", () => {
  const plan = buildMirrorPlan(
    [ani({ status: "watching", updatedAt: new Date(1_000) })],
    [mal({ status: "completed", updatedAt: new Date(9_000) })]
  );

  assert.equal(plan.rows[0].suggestion, "mal");
  assert.deepEqual(plan.rows[0].differences, ["status"]);
});

test("an AniList entry missing from MAL is reported as missing", () => {
  const plan = buildMirrorPlan([ani()], []);

  assert.deepEqual(plan.rows[0].differences, ["missing"]);
  assert.equal(plan.rows[0].mal, null);
  assert.equal(plan.rows[0].suggestion, "anilist");
});

test("a MAL entry missing from AniList is surfaced too", () => {
  const plan = buildMirrorPlan([], [mal({ malMediaId: 777, title: "Only" })]);

  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].anilist, null);
  assert.equal(plan.rows[0].anilistMediaId, null);
  assert.equal(plan.rows[0].suggestion, "mal");
});

test("entries with no MAL id are set aside as unmappable", () => {
  const plan = buildMirrorPlan(
    [ani({ malMediaId: null, title: "AniList only" })],
    []
  );

  assert.equal(plan.rows.length, 0);
  assert.deepEqual(plan.unmappable, [
    { title: "AniList only", anilistMediaId: 1 },
  ]);
});

test("biggest progress gaps sort first", () => {
  const plan = buildMirrorPlan(
    [
      ani({ anilistMediaId: 1, malMediaId: 1, title: "Small", progress: 5 }),
      ani({ anilistMediaId: 2, malMediaId: 2, title: "Large", progress: 20 }),
    ],
    [
      mal({ malMediaId: 1, title: "Small", progress: 4 }),
      mal({ malMediaId: 2, title: "Large", progress: 1 }),
    ]
  );

  assert.deepEqual(
    plan.rows.map((r) => r.title),
    ["Large", "Small"]
  );
});
