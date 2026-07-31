import { test } from "node:test";
import assert from "node:assert/strict";

import { buildQuery, summarizeReleases } from "./discover.ts";
import type { NyaaRelease } from "./rss.ts";

function release(over: Partial<NyaaRelease>): NyaaRelease {
  return {
    nyaaId: 1,
    rawTitle: "x",
    infoHash: "h",
    magnetUri: "magnet:?xt=urn:btih:h",
    sizeBytes: null,
    seeders: 0,
    leechers: 0,
    publishedAt: null,
    releaseGroup: null,
    episodeNumber: null,
    quality: null,
    isBatch: false,
    ...over,
  };
}

test("ranks groups by release count, then by seeder health", () => {
  const result = summarizeReleases([
    release({ releaseGroup: "SubsPlease", quality: "1080p", seeders: 500 }),
    release({ releaseGroup: "SubsPlease", quality: "1080p", seeders: 400 }),
    release({ releaseGroup: "SubsPlease", quality: "720p", seeders: 20 }),
    release({ releaseGroup: "Erai-raws", quality: "1080p", seeders: 900 }),
    release({ releaseGroup: "ASW", quality: "1080p", seeders: 10 }),
    release({ releaseGroup: "ASW", quality: "1080p", seeders: 50 }),
  ]);

  assert.deepEqual(
    result.groups.map((g) => g.releaseGroup),
    ["SubsPlease", "ASW", "Erai-raws"]
  );

  const subsplease = result.groups[0];
  assert.equal(subsplease.releaseCount, 3);
  assert.equal(subsplease.peakSeeders, 500);
  // Qualities come back best-first
  assert.deepEqual(subsplease.qualities, ["1080p", "720p"]);
});

test("defaults to 1080p when available", () => {
  const result = summarizeReleases([
    release({ releaseGroup: "A", quality: "720p" }),
    release({ releaseGroup: "A", quality: "1080p" }),
    release({ releaseGroup: "A", quality: "2160p" }),
  ]);

  assert.deepEqual(result.qualities, ["2160p", "1080p", "720p"]);
  assert.equal(result.defaultQuality, "1080p");
});

test("falls back to the best available quality when there is no 1080p", () => {
  const result = summarizeReleases([
    release({ releaseGroup: "A", quality: "720p" }),
    release({ releaseGroup: "A", quality: "480p" }),
  ]);
  assert.equal(result.defaultQuality, "720p");
});

test("recommends the most prolific group offering the default quality", () => {
  const result = summarizeReleases([
    // Most releases overall, but 720p only
    release({ releaseGroup: "OnlySD", quality: "720p" }),
    release({ releaseGroup: "OnlySD", quality: "720p" }),
    release({ releaseGroup: "OnlySD", quality: "720p" }),
    release({ releaseGroup: "HasHD", quality: "1080p" }),
    release({ releaseGroup: "HasHD", quality: "1080p" }),
  ]);

  assert.equal(result.defaultQuality, "1080p");
  assert.equal(result.groups.find((g) => g.recommended)?.releaseGroup, "HasHD");
});

test("releases with no identifiable group still count toward quality options", () => {
  const result = summarizeReleases([
    release({ releaseGroup: null, quality: "1080p" }),
  ]);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.qualities, ["1080p"]);
  assert.equal(result.totalReleases, 1);
});

test("composes a Nyaa query from the user's picks", () => {
  assert.equal(
    buildQuery("mushoku tensei s3", {
      releaseGroup: "subsplease",
      quality: "1080p",
    }),
    "mushoku tensei s3 1080p subsplease"
  );
  assert.equal(
    buildQuery("mushoku tensei s3", { releaseGroup: null, quality: null }),
    "mushoku tensei s3"
  );
});
