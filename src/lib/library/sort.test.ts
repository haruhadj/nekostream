import assert from "node:assert/strict";
import { test } from "node:test";

import { sortEntries, type SortableEntry } from "./sort.ts";

function entry(
  titleRomaji: string,
  overrides: Partial<SortableEntry> = {}
): SortableEntry & { titleRomaji: string } {
  return {
    titleRomaji,
    titleEnglish: null,
    progress: 0,
    totalEpisodes: null,
    lastActivityAt: null,
    anilistAddedAt: null,
    ...overrides,
  };
}

const titles = (entries: { titleRomaji: string }[]) =>
  entries.map((e) => e.titleRomaji);

test("sorts by title using the displayed English title when present", () => {
  const entries = [
    entry("Zankyou", { titleEnglish: "Anzu" }),
    entry("Bakemono"),
  ];

  assert.deepEqual(titles(sortEntries(entries, "title-asc")), [
    "Zankyou",
    "Bakemono",
  ]);
  assert.deepEqual(titles(sortEntries(entries, "title-desc")), [
    "Bakemono",
    "Zankyou",
  ]);
});

test("orders newest first for updated and added", () => {
  const entries = [
    entry("old", {
      lastActivityAt: new Date(1_000),
      anilistAddedAt: new Date(9_000),
    }),
    entry("new", {
      lastActivityAt: new Date(9_000),
      anilistAddedAt: new Date(1_000),
    }),
  ];

  assert.deepEqual(titles(sortEntries(entries, "updated")), ["new", "old"]);
  assert.deepEqual(titles(sortEntries(entries, "added")), ["old", "new"]);
});

test("ranks by remaining episodes, with unknown totals last", () => {
  const entries = [
    entry("unknown", { progress: 3 }),
    entry("two-left", { progress: 10, totalEpisodes: 12 }),
    entry("finished", { progress: 12, totalEpisodes: 12 }),
    entry("many-left", { progress: 1, totalEpisodes: 24 }),
  ];

  assert.deepEqual(titles(sortEntries(entries, "remaining")), [
    "many-left",
    "two-left",
    "finished",
    "unknown",
  ]);
});

test("breaks ties on title so the order is stable", () => {
  const same = { lastActivityAt: new Date(5_000) };
  const entries = [entry("Cowboy", same), entry("Akira", same)];

  assert.deepEqual(titles(sortEntries(entries, "updated")), [
    "Akira",
    "Cowboy",
  ]);
});

test("places entries with no recorded activity last, never first", () => {
  const entries = [
    entry("unknown-a"),
    entry("touched-long-ago", { lastActivityAt: new Date(1) }),
    entry("unknown-b"),
    entry("touched-recently", { lastActivityAt: new Date(9_000) }),
  ];

  assert.deepEqual(titles(sortEntries(entries, "updated")), [
    "touched-recently",
    "touched-long-ago",
    "unknown-a",
    "unknown-b",
  ]);
});

test("does not mutate the input array", () => {
  const entries = [entry("b"), entry("a")];
  sortEntries(entries, "title-asc");
  assert.deepEqual(titles(entries), ["b", "a"]);
});
