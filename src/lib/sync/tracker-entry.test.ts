/**
 * Pins the HTTP contract of the tracker read/write/delete calls.
 *
 * These exist because the same MyAnimeList PATCH and AniList mutation were
 * implemented several times over with subtly different bodies and error types.
 * Consolidating them is only safe if the wire format below stays identical.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { stubFetch } from "../test-support/fetch-stub.ts";
import { MalError } from "../mal/queries.ts";
import {
  deleteAniListEntry,
  deleteMalEntry,
  readAniListEntry,
  readMalEntry,
  writeAniListEntry,
  writeMalEntry,
} from "./tracker-entry.ts";

test("writeMalEntry PATCHes my_list_status as form data", async () => {
  const fetch = stubFetch();

  try {
    await writeMalEntry("token-abc", 5114, {
      progress: 12,
      status: "watching",
      score: 8,
    });

    const call = fetch.only();
    assert.equal(
      call.url,
      "https://api.myanimelist.net/v2/anime/5114/my_list_status"
    );
    assert.equal(call.method, "PATCH");
    assert.equal(call.headers.authorization, "Bearer token-abc");
    assert.equal(
      call.headers["content-type"],
      "application/x-www-form-urlencoded"
    );
    assert.deepEqual(fetch.form(), {
      num_watched_episodes: "12",
      status: "watching",
      is_rewatching: "false",
      score: "8",
    });
  } finally {
    fetch.restore();
  }
});

test("writeMalEntry sends a rewatch as watching plus the is_rewatching flag", async () => {
  const fetch = stubFetch();

  try {
    await writeMalEntry("t", 1, { progress: 3, status: "repeating", score: 0 });

    assert.equal(fetch.form().status, "watching");
    assert.equal(fetch.form().is_rewatching, "true");
  } finally {
    fetch.restore();
  }
});

test("a 401 from MyAnimeList asks the user to relink rather than echoing the body", async () => {
  const fetch = stubFetch([{ status: 401, text: "invalid_token" }]);

  try {
    await assert.rejects(
      () =>
        writeMalEntry("stale", 1, {
          progress: 1,
          status: "watching",
          score: 0,
        }),
      (error: unknown) => {
        assert.ok(error instanceof MalError);
        assert.equal(error.status, 401);
        assert.equal(
          error.message,
          "MyAnimeList rejected the token. Link the account again."
        );
        return true;
      }
    );
  } finally {
    fetch.restore();
  }
});

test("other MyAnimeList failures surface the status and a truncated body", async () => {
  const fetch = stubFetch([{ status: 500, text: "x".repeat(200) }]);

  try {
    await assert.rejects(
      () =>
        writeMalEntry("t", 1, { progress: 1, status: "watching", score: 0 }),
      (error: unknown) => {
        assert.ok(error instanceof MalError);
        assert.equal(error.status, 500);
        assert.equal(
          error.message,
          `MyAnimeList returned 500: ${"x".repeat(80)}`
        );
        return true;
      }
    );
  } finally {
    fetch.restore();
  }
});

test("readMalEntry reports an absent list entry as not existing", async () => {
  const fetch = stubFetch([{ json: { num_episodes: 26 } }]);

  try {
    const entry = await readMalEntry("t", 1);

    assert.deepEqual(entry, {
      exists: false,
      progress: 0,
      status: null,
      score: 0,
      totalEpisodes: 26,
    });
  } finally {
    fetch.restore();
  }
});

test("readMalEntry maps a rewatch back to the repeating status", async () => {
  const fetch = stubFetch([
    {
      json: {
        num_episodes: 0,
        my_list_status: {
          status: "watching",
          num_episodes_watched: 4,
          is_rewatching: true,
          score: 7,
        },
      },
    },
  ]);

  try {
    const entry = await readMalEntry("t", 1);

    assert.deepEqual(entry, {
      exists: true,
      progress: 4,
      status: "repeating",
      score: 7,
      // MyAnimeList reports an unknown episode count as 0, which is not a count.
      totalEpisodes: null,
    });
  } finally {
    fetch.restore();
  }
});

test("deleteMalEntry treats an already-absent entry as success", async () => {
  const fetch = stubFetch([{ status: 404 }]);

  try {
    await deleteMalEntry("t", 1);

    assert.equal(fetch.only().method, "DELETE");
  } finally {
    fetch.restore();
  }
});

test("deleteMalEntry still reports a real failure", async () => {
  const fetch = stubFetch([{ status: 500 }]);

  try {
    await assert.rejects(() => deleteMalEntry("t", 1), MalError);
  } finally {
    fetch.restore();
  }
});

test("writeAniListEntry widens a 0-10 score to AniList's 100-point scoreRaw", async () => {
  const fetch = stubFetch([
    { json: { data: { SaveMediaListEntry: { id: 1 } } } },
  ]);

  try {
    await writeAniListEntry("token-abc", 21, {
      progress: 12,
      status: "completed",
      score: 8,
    });

    const call = fetch.only();
    assert.equal(call.url, "https://graphql.anilist.co");
    assert.equal(call.headers.authorization, "Bearer token-abc");

    assert.deepEqual(fetch.graphql().variables, {
      mediaId: 21,
      progress: 12,
      status: "COMPLETED",
      score: 80,
    });
  } finally {
    fetch.restore();
  }
});

test("readAniListEntry reports an anime that is not on the list", async () => {
  const fetch = stubFetch([
    { json: { data: { Media: { episodes: 12, mediaListEntry: null } } } },
  ]);

  try {
    const entry = await readAniListEntry("t", 21);

    assert.deepEqual(entry, {
      exists: false,
      progress: 0,
      status: null,
      score: 0,
      totalEpisodes: 12,
    });
  } finally {
    fetch.restore();
  }
});

test("deleteAniListEntry looks the entry up first and no-ops when absent", async () => {
  const fetch = stubFetch([
    { json: { data: { Media: { mediaListEntry: null } } } },
  ]);

  try {
    await deleteAniListEntry("t", 21);

    // Only the lookup query — no DeleteMediaListEntry mutation follows.
    assert.equal(fetch.calls.length, 1);
    assert.match(fetch.graphql().query, /mediaListEntry/);
  } finally {
    fetch.restore();
  }
});

test("deleteAniListEntry deletes by the id the lookup returned", async () => {
  const fetch = stubFetch([
    { json: { data: { Media: { mediaListEntry: { id: 999 } } } } },
    { json: { data: { DeleteMediaListEntry: { deleted: true } } } },
  ]);

  try {
    await deleteAniListEntry("t", 21);

    assert.equal(fetch.calls.length, 2);
    assert.match(fetch.graphql(1).query, /DeleteMediaListEntry/);
    assert.deepEqual(fetch.graphql(1).variables, { id: 999 });
  } finally {
    fetch.restore();
  }
});
