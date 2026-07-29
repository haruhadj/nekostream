import { eq } from "drizzle-orm";

import { db } from "@/db";
import { episode, rssFilter } from "@/db/schema";
import { fetchReleases } from "@/lib/nyaa/rss";

export type RefreshResult = {
  fetched: number;
  added: number;
  fetchedAt: Date;
};

/**
 * Pulls the entry's saved Nyaa feed and stores any releases not seen before.
 * Idempotent: re-running only adds genuinely new torrents, so the manual
 * refresh button is safe to hammer.
 */
export async function refreshEpisodes(
  libraryEntryId: string
): Promise<RefreshResult> {
  const [filter] = await db
    .select()
    .from(rssFilter)
    .where(eq(rssFilter.libraryEntryId, libraryEntryId))
    .limit(1);

  if (!filter) {
    throw new Error("This anime has no saved Nyaa filter yet.");
  }

  const releases = await fetchReleases({
    query: filter.query,
    category: filter.category,
    filter: filter.filter,
  });

  const fetchedAt = new Date();

  let added = 0;
  if (releases.length > 0) {
    const rows = releases.map((release) => ({
      id: crypto.randomUUID(),
      libraryEntryId,
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
    }));

    // The (libraryEntryId, nyaaId) unique index makes re-inserts no-ops.
    const inserted = await db
      .insert(episode)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: episode.id });

    added = inserted.length;
  }

  await db
    .update(rssFilter)
    .set({ lastFetchedAt: fetchedAt, updatedAt: fetchedAt })
    .where(eq(rssFilter.libraryEntryId, libraryEntryId));

  return { fetched: releases.length, added, fetchedAt };
}
