import { test } from "node:test";
import assert from "node:assert/strict";

import { parseReleaseTitle } from "./parse-title.ts";

/** Every title below was taken verbatim from the live nyaa.si c=1_2 RSS feed. */
const CASES: Array<{
  title: string;
  group: string | null;
  episode: number | null;
  quality: string | null;
}> = [
  {
    title:
      "[SubsPlease] Tefuda ga Oome no Victoria - 04 (1080p) [F188F6D4].mkv",
    group: "SubsPlease",
    episode: 4,
    quality: "1080p",
  },
  {
    title: "[ASW] Tefuda ga Oome no Victoria - 04 [1080p HEVC x265 10Bit][AAC]",
    group: "ASW",
    episode: 4,
    quality: "1080p",
  },
  {
    title:
      "[Judas] Tefuda ga Oome no Victoria (Victoria of Many Faces) - S01E04 [1080p][HEVC x265 10bit][Multi-Subs] (Weekly)",
    group: "Judas",
    episode: 4,
    quality: "1080p",
  },
  {
    title:
      "[Erai-raws] Yoroi-Shinden Samurai Troopers Part 2 - 04 [1080p CR WEB-DL AVC AAC][MultiSub][0C3A2190]",
    group: "Erai-raws",
    episode: 4,
    quality: "1080p",
  },
  {
    title:
      "[Breeze] Mushoku Tensei S03E05 [1080p AV1] | Jobless Reincarnation (weekly)",
    group: "Breeze",
    episode: 5,
    quality: "1080p",
  },
  {
    title:
      "[ToonsHub] Victoria of Many Faces S01E04 1080p CR WEB-DL AAC2.0 H.264 (Tefuda ga Oome no Victoria, Multi-Subs)",
    group: "ToonsHub",
    episode: 4,
    quality: "1080p",
  },
  // No bracketed group — scene-style "-VARYG" suffix before the alt-title parens
  {
    title:
      "Victoria of Many Faces S01E04 Are You Going to Arrest Me 1080p CR WEB-DL AAC2.0 H.264-VARYG (Tefuda ga Oome no Victoria, Multi-Subs)",
    group: "VARYG",
    episode: 4,
    quality: "1080p",
  },
  // "EPISODE 04" also present; SxxExx must win rather than double-matching
  {
    title:
      "THE GHOST IN THE SHELL S01E04 EPISODE 04 ROBOT RONDO 1080p AMZN WEB-DL MULTi DDP2.0 H.264-VARYG (Koukaku Kidoutai: THE GHOST IN THE SHELL, Multi-Audio, Multi-Subs)",
    group: "VARYG",
    episode: 4,
    quality: "1080p",
  },
  // A movie: a bare year, no episode number anywhere
  {
    title:
      "Kimetsu no Yaiba Infinity Castle 2025 REPACK 1080p BluRay Remux AVC TrueHD 5.1-KaiZen",
    group: "KaiZen",
    episode: null,
    quality: "1080p",
  },
  {
    title:
      "[ToonsHub] Demon Slayer Kimetsu no Yaiba Infinity Castle (2025) 1080p NF WEB-DL DUAL AAC2.0 H.264 (Kimetsu no Yaiba: Mugenjou-hen Movie 1 - Akaza Sairai, Dual-Audio, Multi-Subs)",
    group: "ToonsHub",
    episode: null,
    quality: "1080p",
  },
  {
    title:
      "[Gecko] Saved by the Ice Cold Prince's Embrace - S01E04 (身代わり令嬢を救ったのは冷酷無慈悲な氷の王子の愛でした; Migawari Reijou wo Sukutta no wa Reikoku Mujihi na Koori no Ouji no Ai deshita) [YTB.WEB-DL 1080P AVC, Opus, M-SUB][76166603]",
    group: "Gecko",
    episode: 4,
    quality: "1080p",
  },
];

test("parses release titles from the live Nyaa corpus", () => {
  for (const c of CASES) {
    const parsed = parseReleaseTitle(c.title);
    assert.equal(parsed.releaseGroup, c.group, `group for: ${c.title}`);
    assert.equal(parsed.episodeNumber, c.episode, `episode for: ${c.title}`);
    assert.equal(parsed.quality, c.quality, `quality for: ${c.title}`);
  }
});

test("a CRC32 hash in leading brackets is not treated as a release group", () => {
  assert.equal(
    parseReleaseTitle("[F188F6D4] Some Show - 04").releaseGroup,
    null
  );
});

test("batches report no single episode number", () => {
  const parsed = parseReleaseTitle(
    "[Judas] Some Show (Season 1) [01-12] [1080p][HEVC x265 10bit][Batch]"
  );
  assert.equal(parsed.isBatch, true);
  assert.equal(parsed.episodeNumber, null);
});

test("version suffixes are ignored", () => {
  assert.equal(
    parseReleaseTitle("[SubsPlease] Some Show - 07v2 (1080p) [ABCD1234].mkv")
      .episodeNumber,
    7
  );
});

test("4K is normalized to 2160p", () => {
  assert.equal(
    parseReleaseTitle("[Group] Show - 01 [4K][HDR]").quality,
    "2160p"
  );
});
