import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMagnetUri,
  buildRssUrl,
  parseRssFeed,
  parseSizeToBytes,
} from "./rss.ts";

/** Trimmed from a real nyaa.si RSS response. */
const SAMPLE_FEED = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:nyaa="https://nyaa.si/xmlns/nyaa" version="2.0">
  <channel>
    <title>Nyaa - "mushoku tensei 1080p" - Torrent File RSS</title>
    <item>
      <title>[Breeze] Mushoku Tensei S03E05 [1080p AV1] | Jobless Reincarnation (weekly)</title>
      <link>https://nyaa.si/download/2138496.torrent</link>
      <guid isPermaLink="true">https://nyaa.si/view/2138496</guid>
      <pubDate>Tue, 28 Jul 2026 06:53:20 -0000</pubDate>
      <nyaa:seeders>27</nyaa:seeders>
      <nyaa:leechers>1</nyaa:leechers>
      <nyaa:infoHash>9fbe06d43568ab7368dcd05239e49f00ee39eacc</nyaa:infoHash>
      <nyaa:categoryId>1_2</nyaa:categoryId>
      <nyaa:size>820.0 MiB</nyaa:size>
    </item>
    <item>
      <title>[SubsPlease] Some Show - 04 (1080p) [F188F6D4].mkv</title>
      <guid isPermaLink="true">https://nyaa.si/view/2138355</guid>
      <pubDate>Mon, 27 Jul 2026 20:21:10 -0000</pubDate>
      <nyaa:seeders>86</nyaa:seeders>
      <nyaa:leechers>7</nyaa:leechers>
      <nyaa:infoHash>9cf412c7a35787e4e921e1134669fc21872ce2b9</nyaa:infoHash>
      <nyaa:size>1.5 GiB</nyaa:size>
    </item>
  </channel>
</rss>`;

test("parses a feed into releases with parsed title metadata", () => {
  const releases = parseRssFeed(SAMPLE_FEED);
  assert.equal(releases.length, 2);

  const [first, second] = releases;

  assert.equal(first.nyaaId, 2138496);
  assert.equal(first.releaseGroup, "Breeze");
  assert.equal(first.episodeNumber, 5);
  assert.equal(first.quality, "1080p");
  assert.equal(first.infoHash, "9fbe06d43568ab7368dcd05239e49f00ee39eacc");
  assert.equal(first.seeders, 27);
  assert.equal(first.leechers, 1);
  assert.equal(first.sizeBytes, 859832320);
  assert.ok(first.publishedAt instanceof Date);

  assert.equal(second.nyaaId, 2138355);
  assert.equal(second.releaseGroup, "SubsPlease");
  assert.equal(second.episodeNumber, 4);
});

test("magnet uri carries the info hash and trackers", () => {
  const magnet = buildMagnetUri("abc123", "Some Show - 04");
  assert.ok(magnet.startsWith("magnet:?xt=urn:btih:abc123&"));
  assert.ok(magnet.includes("dn=Some+Show+-+04"));
  assert.ok(
    magnet.includes("tr=http%3A%2F%2Fnyaa.tracker.wf%3A7777%2Fannounce")
  );
});

test("builds the documented Nyaa RSS url shape", () => {
  const url = buildRssUrl({
    query: "mushoku tensei s3 1080p subsplease",
    category: "1_2",
    filter: "0",
  });
  assert.equal(
    url,
    "https://nyaa.si/?page=rss&q=mushoku+tensei+s3+1080p+subsplease&c=1_2&f=0"
  );
});

test("converts human-readable sizes to bytes", () => {
  assert.equal(parseSizeToBytes("820.0 MiB"), 859832320);
  assert.equal(parseSizeToBytes("1.5 GiB"), 1610612736);
  assert.equal(parseSizeToBytes("nonsense"), null);
  assert.equal(parseSizeToBytes(undefined), null);
});

test("items missing an id or info hash are dropped rather than half-stored", () => {
  const feed = `<rss version="2.0"><channel><item>
      <title>Broken</title><guid>https://nyaa.si/view/</guid>
    </item></channel></rss>`;
  assert.deepEqual(parseRssFeed(feed), []);
});

test("an empty feed yields no releases", () => {
  assert.deepEqual(parseRssFeed(`<rss version="2.0"><channel/></rss>`), []);
});
