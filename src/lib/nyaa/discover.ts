import { fetchReleases, type NyaaRelease } from "./rss.ts";

export type GroupSuggestion = {
  releaseGroup: string;
  /** How many releases this group has in the probe window */
  releaseCount: number;
  /** Qualities this group actually publishes, best first */
  qualities: string[];
  /** Highest seeder count seen — a rough proxy for how well-seeded the group is */
  peakSeeders: number;
  /** Set on the one entry we recommend picking */
  recommended: boolean;
};

export type DiscoveryResult = {
  groups: GroupSuggestion[];
  qualities: string[];
  /** plan.md: 1080p is the default when the title offers it */
  defaultQuality: string | null;
  totalReleases: number;
};

/** Descending preference — used to order quality chips and pick a default. */
const QUALITY_RANK = ["2160p", "1440p", "1080p", "900p", "720p", "540p", "480p", "360p"];

function byQualityRank(a: string, b: string) {
  const ia = QUALITY_RANK.indexOf(a);
  const ib = QUALITY_RANK.indexOf(b);
  return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) -
    (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
}

export function summarizeReleases(releases: NyaaRelease[]): DiscoveryResult {
  const byGroup = new Map<
    string,
    { count: number; qualities: Set<string>; peakSeeders: number }
  >();
  const allQualities = new Set<string>();

  for (const release of releases) {
    if (release.quality) allQualities.add(release.quality);
    if (!release.releaseGroup) continue;

    const existing = byGroup.get(release.releaseGroup) ?? {
      count: 0,
      qualities: new Set<string>(),
      peakSeeders: 0,
    };

    existing.count += 1;
    if (release.quality) existing.qualities.add(release.quality);
    existing.peakSeeders = Math.max(existing.peakSeeders, release.seeders ?? 0);

    byGroup.set(release.releaseGroup, existing);
  }

  const groups: GroupSuggestion[] = [...byGroup.entries()]
    .map(([releaseGroup, stats]) => ({
      releaseGroup,
      releaseCount: stats.count,
      qualities: [...stats.qualities].sort(byQualityRank),
      peakSeeders: stats.peakSeeders,
      recommended: false,
    }))
    // Popularity first, then health — a group with one well-seeded batch
    // shouldn't outrank one releasing the whole season.
    .sort(
      (a, b) => b.releaseCount - a.releaseCount || b.peakSeeders - a.peakSeeders
    );

  const qualities = [...allQualities].sort(byQualityRank);
  const defaultQuality = qualities.includes("1080p")
    ? "1080p"
    : qualities[0] ?? null;

  // Recommend the most prolific group that actually offers the default quality.
  const recommended =
    groups.find((g) => defaultQuality && g.qualities.includes(defaultQuality)) ??
    groups[0];
  if (recommended) recommended.recommended = true;

  return {
    groups,
    qualities,
    defaultQuality,
    totalReleases: releases.length,
  };
}

/**
 * Probes Nyaa for a title so the first-time setup screen can offer real release
 * groups and qualities instead of an empty text box.
 */
export async function discoverFilters(
  title: string,
  { category = "1_2", filter = "0" }: { category?: string; filter?: string } = {}
): Promise<DiscoveryResult> {
  const releases = await fetchReleases({ query: title, category, filter });
  return summarizeReleases(releases);
}

/** Composes the Nyaa `q` value from the user's picks. */
export function buildQuery(
  title: string,
  { releaseGroup, quality }: { releaseGroup?: string | null; quality?: string | null }
) {
  return [title, quality, releaseGroup].filter(Boolean).join(" ").trim();
}
