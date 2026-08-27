/**
 * The saved Nyaa feed and the releases found through it, on the device.
 *
 * The port of the filter/episode half of `server/library-routes.ts`. Same
 * shapes, same rules — including the one that matters most here: episodes are
 * keyed on `(libraryEntryId, nyaaId)`, so re-running a search only ever adds
 * genuinely new torrents.
 *
 * Deleting the filter deliberately leaves the episodes alone. That is the
 * server's "stop tracking" behaviour: the releases already found stay
 * readable, nothing new is fetched.
 */

import { desc, eq } from "drizzle-orm";

import type { SavedFilter } from "@shared/nyaa/filter";

import { db } from "./client";
import { episode, rssFilter, type EpisodeRow, type RssFilterRow } from "./schema";

export type { EpisodeRow, RssFilterRow };

export async function getFilter(
  libraryEntryId: string
): Promise<RssFilterRow | null> {
  const [row] = await db
    .select()
    .from(rssFilter)
    .where(eq(rssFilter.libraryEntryId, libraryEntryId))
    .limit(1);

  return row ?? null;
}

/**
 * One feed per entry — enforced by `rss_filter_library_entry_idx`, so this is
 * an upsert rather than a check-then-write.
 */
export async function saveFilter(
  libraryEntryId: string,
  values: SavedFilter
): Promise<void> {
  await db
    .insert(rssFilter)
    .values({ libraryEntryId, ...values })
    .onConflictDoUpdate({
      target: rssFilter.libraryEntryId,
      set: { ...values, updatedAt: new Date() },
    });
}

/**
 * Stop tracking: the feed goes, the episodes stay. Also clears the poll state
 * with it, since that lived on the filter row.
 */
export async function deleteFilter(libraryEntryId: string): Promise<void> {
  await db.delete(rssFilter).where(eq(rssFilter.libraryEntryId, libraryEntryId));
}

/**
 * Newest release first — what the list shows. Episode number is not the sort
 * key because it is nullable (batches, movies) and because two releases can
 * share one.
 */
export async function listEpisodes(
  libraryEntryId: string
): Promise<EpisodeRow[]> {
  return db
    .select()
    .from(episode)
    .where(eq(episode.libraryEntryId, libraryEntryId))
    .orderBy(desc(episode.publishedAt), desc(episode.nyaaId));
}

export type NewEpisode = {
  nyaaId: number;
  episodeNumber: number | null;
  rawTitle: string;
  releaseGroup: string | null;
  quality: string | null;
  infoHash: string;
  magnetUri: string;
  sizeBytes: number | null;
  seeders: number | null;
  leechers: number | null;
  publishedAt: Date | null;
};

/** Returns how many rows were genuinely new. */
export async function insertEpisodes(
  libraryEntryId: string,
  releases: NewEpisode[]
): Promise<number> {
  if (releases.length === 0) return 0;

  const inserted = await db
    .insert(episode)
    .values(releases.map((release) => ({ libraryEntryId, ...release })))
    // The (libraryEntryId, nyaaId) unique index makes re-inserts no-ops.
    .onConflictDoNothing()
    .returning({ id: episode.id });

  return inserted.length;
}

export async function markFetched(
  libraryEntryId: string,
  at: Date
): Promise<void> {
  await db
    .update(rssFilter)
    .set({ lastFetchedAt: at, updatedAt: at })
    .where(eq(rssFilter.libraryEntryId, libraryEntryId));
}
