import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, isNotNull } from "drizzle-orm";

import { CalendarList, type CalendarItem } from "@/components/calendar-list";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { libraryEntry, rssFilter } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function CalendarPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const rows = await db
    .select({
      id: libraryEntry.id,
      titleRomaji: libraryEntry.titleRomaji,
      titleEnglish: libraryEntry.titleEnglish,
      coverImageUrl: libraryEntry.coverImageUrl,
      nextAiringAt: libraryEntry.nextAiringAt,
      nextAiringEpisode: libraryEntry.nextAiringEpisode,
      hasFeed: rssFilter.id,
    })
    .from(libraryEntry)
    .leftJoin(rssFilter, eq(rssFilter.libraryEntryId, libraryEntry.id))
    .where(
      and(
        eq(libraryEntry.userId, session.user.id),
        isNotNull(libraryEntry.nextAiringAt)
      )
    )
    .orderBy(asc(libraryEntry.nextAiringAt));

  // nextAiringAt/nextAiringEpisode are set together by lib/airing/poller.ts —
  // the isNotNull filter above already guarantees both are present here.
  const entries: CalendarItem[] = rows.map((row) => ({
    id: row.id,
    titleRomaji: row.titleRomaji,
    titleEnglish: row.titleEnglish,
    coverImageUrl: row.coverImageUrl,
    nextAiringAt: row.nextAiringAt!.toISOString(),
    nextAiringEpisode: row.nextAiringEpisode!,
    hasFeed: row.hasFeed !== null,
  }));

  return (
    <>
      <SiteHeader active="calendar" />

      <main className="pb-tabbar mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-2xl">
          Schedule
        </h1>
        <p className="mt-2 text-sm text-muted">
          The next episode for everything in your library that&rsquo;s still
          airing.
        </p>

        {entries.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/20 px-6 py-12 text-center sm:p-10">
            <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-muted">
              Nothing airing right now. Shows with a broadcast still ahead
              will show up here.
            </p>
          </div>
        ) : (
          <CalendarList entries={entries} />
        )}
      </main>
    </>
  );
}
