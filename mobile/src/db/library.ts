/**
 * Every read and write the screens do against the device database.
 *
 * This is the device's answer to `server/library-routes.ts` plus
 * `lib/library/schedule.ts`. Same queries, minus the `userId` scoping that a
 * one-user device cannot need — which is exactly why they live here in one
 * file: the invariant the server enforces per query is enforced here by the
 * schema having no such column at all.
 *
 * Drizzle returns real `Date` objects for the timestamp columns, so rows go
 * straight into `@shared/library/sort` and `@shared/schedule/group` with no
 * parse step. That is the JSON round trip the old `api/types.ts` existed for.
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type { AiringSchedule } from "@shared/anilist/queries";

import { db } from "./client";
import {
  episode,
  libraryEntry,
  rssFilter,
  type LibraryEntryRow,
} from "./schema";

export type { LibraryEntryRow };

/** Newest activity first is the order the library screen sorts from. */
export async function listEntries(): Promise<LibraryEntryRow[]> {
  return db
    .select()
    .from(libraryEntry)
    .orderBy(desc(libraryEntry.lastActivityAt));
}

export async function entryById(id: string): Promise<LibraryEntryRow | null> {
  const [row] = await db
    .select()
    .from(libraryEntry)
    .where(eq(libraryEntry.id, id))
    .limit(1);

  return row ?? null;
}

export async function libraryMediaIds(): Promise<number[]> {
  const rows = await db
    .select({ anilistMediaId: libraryEntry.anilistMediaId })
    .from(libraryEntry);

  return rows.map((row) => row.anilistMediaId);
}

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

export type ImportRow = {
  anilistMediaId: number;
  malMediaId: number | null;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  totalEpisodes: number | null;
  progress: number;
  anilistStatus: string | null;
  lastActivityAt: Date | null;
  anilistAddedAt: Date | null;
};

/** SQLite caps bound parameters per statement, so inserts go in batches. */
const CHUNK_SIZE = 100;

/**
 * Insert-only by design, with one exception — carried over verbatim from
 * `lib/anilist/import.ts`, because it is the rule that makes syncing on every
 * launch safe:
 *
 * an anime already present keeps its locally edited progress and its saved
 * Nyaa filter, so a later sync can never overwrite them. The exception is the
 * two AniList timestamps, which are AniList's facts about the entry rather
 * than local state, and are allowed to move forward.
 */
export async function upsertImported(rows: ImportRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await db
      .insert(libraryEntry)
      .values(rows.slice(i, i + CHUNK_SIZE))
      // Conflicts on library_entry_media_idx (anilistMediaId) — the device's
      // one-row-per-show index, where the server's is (userId, mediaId).
      .onConflictDoUpdate({
        target: libraryEntry.anilistMediaId,
        set: {
          // Never moves backwards: a progress change made here is newer than
          // whatever AniList last recorded, and must not be undone by a sync
          // that arrives after it.
          lastActivityAt: sql`nullif(max(coalesce(${libraryEntry.lastActivityAt}, 0), coalesce(excluded.last_activity_at, 0)), 0)`,
          anilistAddedAt: sql`nullif(max(coalesce(${libraryEntry.anilistAddedAt}, 0), coalesce(excluded.anilist_added_at, 0)), 0)`,
        },
      });
  }
}

/** One title added by hand from Search. Already-present is not an error. */
export async function addEntry(row: {
  anilistMediaId: number;
  malMediaId: number | null;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  totalEpisodes: number | null;
}): Promise<void> {
  await db.insert(libraryEntry).values(row).onConflictDoNothing();
}

/* ------------------------------------------------------------------ *
 * Airing
 * ------------------------------------------------------------------ */

/** Entries whose broadcast times haven't been refreshed since `staleBefore`. */
export async function entriesNeedingAiring(
  staleBefore: Date
): Promise<{ id: string; anilistMediaId: number }[]> {
  const rows = await db
    .select({
      id: libraryEntry.id,
      anilistMediaId: libraryEntry.anilistMediaId,
      airingSyncedAt: libraryEntry.airingSyncedAt,
    })
    .from(libraryEntry);

  return rows
    .filter(
      (row) =>
        row.airingSyncedAt === null ||
        row.airingSyncedAt.getTime() < staleBefore.getTime()
    )
    .map(({ id, anilistMediaId }) => ({ id, anilistMediaId }));
}

/**
 * AniList omits ids it has nothing to say about, so anything not in
 * `schedules` is stamped as checked with a null airing time — otherwise a
 * finished show would be re-queried on every refresh forever.
 */
export async function applyAiringSchedules(
  entries: { id: string; anilistMediaId: number }[],
  schedules: AiringSchedule[],
  now: Date
): Promise<void> {
  const byMediaId = new Map(schedules.map((s) => [s.anilistMediaId, s]));

  for (const entry of entries) {
    const schedule = byMediaId.get(entry.anilistMediaId);

    await db
      .update(libraryEntry)
      .set({
        nextAiringAt: schedule?.nextAiringAt ?? null,
        nextAiringEpisode: schedule?.nextAiringEpisode ?? null,
        airingSyncedAt: now,
      })
      .where(eq(libraryEntry.id, entry.id));
  }
}

/* ------------------------------------------------------------------ *
 * Schedule
 * ------------------------------------------------------------------ */

export type ScheduleRow = {
  id: string;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  airingAt: Date;
  nextAiringEpisode: number;
  progress: number;
  totalEpisodes: number | null;
  hasFeed: boolean;
};

/**
 * Every entry with a next episode, soonest first — the port of
 * `getScheduleEntries()`, including its `hasFeed` left join, which exists so
 * the screen doesn't need one query per row.
 */
export async function scheduleEntries(): Promise<ScheduleRow[]> {
  const rows = await db
    .select({
      id: libraryEntry.id,
      titleRomaji: libraryEntry.titleRomaji,
      titleEnglish: libraryEntry.titleEnglish,
      coverImageUrl: libraryEntry.coverImageUrl,
      nextAiringAt: libraryEntry.nextAiringAt,
      nextAiringEpisode: libraryEntry.nextAiringEpisode,
      progress: libraryEntry.progress,
      totalEpisodes: libraryEntry.totalEpisodes,
      hasFeed: rssFilter.id,
    })
    .from(libraryEntry)
    .leftJoin(rssFilter, eq(rssFilter.libraryEntryId, libraryEntry.id))
    .where(isNotNull(libraryEntry.nextAiringAt))
    .orderBy(asc(libraryEntry.nextAiringAt));

  // nextAiringAt and nextAiringEpisode are written together, so the isNotNull
  // above already guarantees both — the filter keeps that a fact, not a cast.
  return rows.flatMap((row) =>
    row.nextAiringAt && row.nextAiringEpisode !== null
      ? [
          {
            id: row.id,
            titleRomaji: row.titleRomaji,
            titleEnglish: row.titleEnglish,
            coverImageUrl: row.coverImageUrl,
            airingAt: row.nextAiringAt,
            nextAiringEpisode: row.nextAiringEpisode,
            progress: row.progress,
            totalEpisodes: row.totalEpisodes,
            hasFeed: row.hasFeed !== null,
          },
        ]
      : []
  );
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

/**
 * The local half of a progress tick, and it happens first — see
 * `src/sync/progress.ts`. `lastActivityAt` moves because the user just acted;
 * that is what keeps "Last updated" sorting honest.
 */
export async function setProgress(
  id: string,
  progress: number
): Promise<LibraryEntryRow | null> {
  const now = new Date();

  await db
    .update(libraryEntry)
    .set({ progress, lastActivityAt: now, updatedAt: now })
    .where(eq(libraryEntry.id, id));

  return entryById(id);
}

/* ------------------------------------------------------------------ *
 * Episodes (read-only until Phase 4 writes them)
 * ------------------------------------------------------------------ */

export async function episodeCounts(
  entryIds: string[]
): Promise<Map<string, number>> {
  if (entryIds.length === 0) return new Map();

  const rows = await db
    .select({
      libraryEntryId: episode.libraryEntryId,
      count: sql<number>`count(*)`,
    })
    .from(episode)
    .where(and(inArray(episode.libraryEntryId, entryIds)))
    .groupBy(episode.libraryEntryId);

  return new Map(rows.map((row) => [row.libraryEntryId, row.count]));
}
