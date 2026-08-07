import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByDay } from "./group.ts";

const NOW = new Date(2026, 7, 7, 12, 0, 0); // Fri Aug 7 2026, noon local

function entry(id: string, isoLocal: string) {
  return { id, airingAt: new Date(isoLocal) };
}

test("entries on the same day land in one group", () => {
  const groups = groupByDay(
    [entry("a", "2026-08-07T09:00:00"), entry("b", "2026-08-07T21:00:00")],
    NOW
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Today");
  assert.deepEqual(
    groups[0].entries.map((e) => e.id),
    ["a", "b"]
  );
});

test("today, tomorrow and yesterday get named labels", () => {
  const groups = groupByDay(
    [
      entry("yesterday", "2026-08-06T10:00:00"),
      entry("today", "2026-08-07T10:00:00"),
      entry("tomorrow", "2026-08-08T10:00:00"),
    ],
    NOW
  );

  assert.deepEqual(
    groups.map((g) => g.label),
    ["Yesterday", "Today", "Tomorrow"]
  );
});

test("later this week gets a weekday name", () => {
  const groups = groupByDay([entry("thu", "2026-08-13T10:00:00")], NOW);

  assert.equal(groups[0].label, "Thursday");
});

test("more than a week out falls back to a month/day date", () => {
  const groups = groupByDay([entry("far", "2026-09-01T10:00:00")], NOW);

  assert.equal(groups[0].label, "Sep 1");
});

test("a different year is spelled out", () => {
  const groups = groupByDay([entry("nextyear", "2027-01-05T10:00:00")], NOW);

  assert.equal(groups[0].label, "Jan 5, 2027");
});

test("group order follows the input order, not a re-sort", () => {
  // Deliberately handed out of chronological order; the caller (a query
  // ordered by nextAiringAt) is what's expected to sort, not this function.
  const groups = groupByDay(
    [entry("later", "2026-08-08T10:00:00"), entry("earlier", "2026-08-07T10:00:00")],
    NOW
  );

  assert.deepEqual(
    groups.map((g) => g.label),
    ["Tomorrow", "Today"]
  );
});
