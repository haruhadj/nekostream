import assert from "node:assert/strict";
import { test } from "node:test";

import { newEpisodeEmail } from "./notify.ts";

test("the subject names the show and episode", () => {
  const { subject } = newEpisodeEmail({
    titleRomaji: "Mushoku Tensei",
    episodeNumber: 5,
    libraryEntryId: "entry-1",
  });

  assert.equal(subject, "Mushoku Tensei — episode 5 is out");
});

test("the body links back to the anime page", () => {
  const { text } = newEpisodeEmail({
    titleRomaji: "Mushoku Tensei",
    episodeNumber: 5,
    libraryEntryId: "entry-1",
  });

  assert.match(text, /Episode 5/);
  assert.match(text, /\/anime\/entry-1$/);
});
