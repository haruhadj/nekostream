import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { libraryEntry, rssFilter } from "@/db/schema";

export type ScheduleItem = {
  id: string;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  nextAiringAt: string;
  nextAiringEpisode: number;
  progress: number;
  totalEpisodes: number | null;
  hasFeed: boolean;
};

/**
 * Every library entry with a next episode still ahead, ordered soonest
 * first. Shared by `GET /api/library/schedule` and `/schedule` so the API
 * and the page can't drift apart the way `lib/library/filters.ts` already
 * guards against for the library tabs.
 */
export async function getScheduleEntries(userId: string): Promise<ScheduleItem[]> {
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
    .where(
      and(
        eq(libraryEntry.userId, userId),
        isNotNull(libraryEntry.nextAiringAt)
      )
    )
    .orderBy(asc(libraryEntry.nextAiringAt));

  // nextAiringAt/nextAiringEpisode are set together by lib/airing/poller.ts —
  // the isNotNull filter above already guarantees both are present here.
  return rows.map((row) => ({
    id: row.id,
    titleRomaji: row.titleRomaji,
    titleEnglish: row.titleEnglish,
    coverImageUrl: row.coverImageUrl,
    nextAiringAt: row.nextAiringAt!.toISOString(),
    nextAiringEpisode: row.nextAiringEpisode!,
    progress: row.progress,
    totalEpisodes: row.totalEpisodes,
    hasFeed: row.hasFeed !== null,
  }));
}
