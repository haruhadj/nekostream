import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveStatus } from "./status.ts";

test("a partially watched show stays watching", () => {
  assert.equal(deriveStatus(5, 12), "watching");
  assert.equal(deriveStatus(0, 12), "watching");
});

test("reaching the final episode completes the show", () => {
  assert.equal(deriveStatus(12, 12), "completed");
});

test("progress past the listed total still completes", () => {
  // Episode counts on AniList are sometimes lower than what actually aired.
  assert.equal(deriveStatus(13, 12), "completed");
});

test("an unknown episode count never auto-completes", () => {
  // Ongoing shows report null episodes; marking them complete would be wrong.
  assert.equal(deriveStatus(50, null), "watching");
});
