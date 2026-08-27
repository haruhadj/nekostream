/**
 * Re-running an entry's saved Nyaa search — the port of
 * `lib/library/refresh.ts`.
 *
 * Idempotent, for the same reason it is on the server: the
 * `(libraryEntryId, nyaaId)` unique index means re-running only adds torrents
 * that weren't there before, so the Refresh button is safe to hammer.
 *
 * `fetchReleases` itself is shared, not copied — the RSS fetch, the title
 * parsing and the magnet construction all have one definition across the
 * server and this app.
 */

import { fetchReleases } from "@shared/nyaa/rss";

import { getFilter, insertEpisodes, markFetched } from "@/db/nyaa";

export type RefreshResult = {
  fetched: number;
  added: number;
  fetchedAt: Date;
};

export async function refreshEpisodes(
  libraryEntryId: string
): Promise<RefreshResult> {
  const filter = await getFilter(libraryEntryId);

  if (!filter) {
    throw new Error("This anime has no saved Nyaa filter yet.");
  }

  const releases = await fetchReleases({
    query: filter.query,
    category: filter.category,
    filter: filter.filter,
  });

  const fetchedAt = new Date();

  const added = await insertEpisodes(
    libraryEntryId,
    releases.map((release) => ({
      nyaaId: release.nyaaId,
      episodeNumber: release.episodeNumber,
      rawTitle: release.rawTitle,
      releaseGroup: release.releaseGroup,
      quality: release.quality,
      infoHash: release.infoHash,
      magnetUri: release.magnetUri,
      sizeBytes: release.sizeBytes,
      seeders: release.seeders,
      leechers: release.leechers,
      publishedAt: release.publishedAt,
    }))
  );

  await markFetched(libraryEntryId, fetchedAt);

  return { fetched: releases.length, added, fetchedAt };
}
