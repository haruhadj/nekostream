import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { libraryEntry, user } from "@/db/schema";
import { viewerLibrary } from "@/lib/anilist/queries";
import { getValidAccessToken } from "@/lib/tokens";

export type ImportResult = {
  /** Entries newly inserted by this run. */
  added: number;
  /** Entries AniList returned that were already in the local library. */
  skipped: number;
  /** Everything AniList returned, across all lists. */
  total: number;
};

/** SQLite caps bound parameters per statement, so inserts go in batches. */
const CHUNK_SIZE = 100;

/**
 * Mirrors the user's AniList lists into the local library.
 *
 * Insert-only by design, with one exception: an anime already present keeps its
 * locally edited progress and its saved Nyaa filter, so a later sync can never
 * overwrite them. That is what makes this safe to run on every library visit.
 * The exception is lastActivityAt, which is AniList's fact about the entry
 * rather than the user's local state, and so is allowed to move forward.
 */
export async function importAniListLibrary(
  userId: string
): Promise<ImportResult> {
  // Throws TokenError when AniList isn't connected — callers turn that into a
  // "sign in again" message rather than a silent no-op.
  const accessToken = await getValidAccessToken(userId, "anilist");
  const entries = await viewerLibrary(accessToken);

  const rows = entries.map((entry) => ({
    id: crypto.randomUUID(),
    userId,
    anilistMediaId: entry.media.id,
    malMediaId: entry.media.idMal,
    titleRomaji: entry.media.title.romaji,
    titleEnglish: entry.media.title.english,
    coverImageUrl: entry.media.coverImage?.large ?? null,
    totalEpisodes: entry.media.episodes,
    progress: entry.progress ?? 0,
    anilistStatus: entry.status,
    // AniList reports unix seconds; 0 and null both mean "never recorded", and
    // are kept as null so the sort can place them last rather than inventing a
    // timestamp for them.
    lastActivityAt: entry.updatedAt ? new Date(entry.updatedAt * 1000) : null,
    anilistAddedAt: entry.createdAt ? new Date(entry.createdAt * 1000) : null,
  }));

  // Counted up front because the upsert below returns updated rows too, which
  // would otherwise report every existing entry as newly added.
  const existing = new Set(
    (
      await db
        .select({ anilistMediaId: libraryEntry.anilistMediaId })
        .from(libraryEntry)
        .where(eq(libraryEntry.userId, userId))
    ).map((r) => r.anilistMediaId)
  );
  const added = rows.filter((r) => !existing.has(r.anilistMediaId)).length;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await db
      .insert(libraryEntry)
      .values(rows.slice(i, i + CHUNK_SIZE))
      // Conflicts on library_entry_user_media_idx (userId, anilistMediaId).
      .onConflictDoUpdate({
        target: [libraryEntry.userId, libraryEntry.anilistMediaId],
        set: {
          // Never moves backwards: a progress change made here is newer than
          // whatever AniList last recorded, and must not be undone by a sync
          // that arrives after it.
          lastActivityAt: sql`nullif(max(coalesce(${libraryEntry.lastActivityAt}, 0), coalesce(excluded.last_activity_at, 0)), 0)`,
          anilistAddedAt: sql`nullif(max(coalesce(${libraryEntry.anilistAddedAt}, 0), coalesce(excluded.anilist_added_at, 0)), 0)`,
        },
      });
  }

  // Stamped only on success, so a failed run retries on the next visit instead
  // of being throttled out.
  await db
    .update(user)
    .set({ anilistSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(user.id, userId));

  return { added, skipped: rows.length - added, total: rows.length };
}
