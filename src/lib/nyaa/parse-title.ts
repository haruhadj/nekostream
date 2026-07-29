/**
 * Nyaa release titles follow no standard — every fansub group has its own
 * convention. These patterns were written against a live sample of the
 * `c=1_2` (Anime, English-translated) feed; see parse-title.test.ts for the
 * corpus they are pinned to.
 */

export type ParsedTitle = {
  releaseGroup: string | null;
  /** Null for movies, batches, and anything without a single episode number */
  episodeNumber: number | null;
  quality: string | null;
  /** True when the release covers a range of episodes rather than one */
  isBatch: boolean;
};

/** CRC32 checksums appear in brackets and must not be mistaken for a group. */
const CRC32 = /^[0-9a-f]{8}$/i;

const QUALITY = /\b(2160p|1440p|1080p|900p|720p|540p|480p|360p)\b/i;
const FOUR_K = /\b(4k|uhd)\b/i;

/**
 * Episode ranges are only treated as batches when bracketed — an unbracketed
 * "Part 2 - 04" is a season label followed by a single episode, not a range.
 */
const BATCH = /\b(batch|complete)\b|[[(]\s*\d{1,4}\s*[-~]\s*\d{1,4}\s*[\])]/i;

const EPISODE_PATTERNS: RegExp[] = [
  // S03E05, S01E04 — most explicit, so it wins
  /\bS\d{1,3}E(\d{1,4})\b/i,
  // "Title - 04 (1080p)" / "Title - 04 [1080p]" / "Title - 04v2"
  /\s-\s(\d{1,4})(?:v\d)?(?=\s|$|\[|\()/,
  // "E05" / "Ep05" / "Ep 05" standing alone
  /\bE(?:p\s?)?(\d{1,4})\b(?!\d)/i,
];

/** Strips a container extension so it can't be parsed as part of the title. */
function stripExtension(title: string): string {
  return title.replace(/\.(mkv|mp4|avi|mov)$/i, "");
}

function extractReleaseGroup(title: string): string | null {
  // Convention 1: leading [Group] — but brackets also carry CRC32 hashes
  const leading = title.match(/^\s*\[([^\]]+)\]/);
  if (leading) {
    const candidate = leading[1].trim();
    if (!CRC32.test(candidate)) return candidate;
  }

  // Convention 2: scene-style "-GROUP" suffix, e.g. "H.264-VARYG (...)"
  // Anchored before any trailing parenthetical, which holds alt titles.
  const withoutTrailingParens = title.replace(/\s*\([^()]*\)\s*$/, "").trim();
  const suffix = withoutTrailingParens.match(/-([A-Za-z][A-Za-z0-9_.]{1,20})$/);
  if (suffix) return suffix[1];

  return null;
}

function extractQuality(title: string): string | null {
  const direct = title.match(QUALITY);
  if (direct) return direct[1].toLowerCase();
  if (FOUR_K.test(title)) return "2160p";
  return null;
}

function extractEpisodeNumber(title: string): number | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed)) return parsed;
    }
  }
  return null;
}

export function parseReleaseTitle(rawTitle: string): ParsedTitle {
  const title = stripExtension(rawTitle);

  const isBatch = BATCH.test(title);
  // A batch spans many episodes, so a single number would be misleading.
  const episodeNumber = isBatch ? null : extractEpisodeNumber(title);

  return {
    releaseGroup: extractReleaseGroup(title),
    episodeNumber,
    quality: extractQuality(title),
    isBatch,
  };
}
