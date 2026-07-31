import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { AniListSync } from "@/components/anilist-sync";
import { LibraryGrid, type LibraryCard } from "@/components/library-grid";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { libraryEntry, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  applyFilter,
  FILTERS,
  type LibraryFilter,
} from "@/lib/library/filters";
import { DEFAULT_SORT, sortEntries } from "@/lib/library/sort";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { status } = await searchParams;
  const active = FILTERS.find((f) => f.key === status) ?? FILTERS[0];

  const [entries, [account]] = await Promise.all([
    db
      .select()
      .from(libraryEntry)
      .where(eq(libraryEntry.userId, session.user.id))
      .orderBy(asc(libraryEntry.titleRomaji)),
    db
      .select({ anilistSyncedAt: user.anilistSyncedAt })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
  ]);

  // Counts come from the full set so every tab can show its size — the library
  // is local and small enough that filtering in memory beats six more queries.
  const countFor = (filter: LibraryFilter) =>
    applyFilter(entries, filter).length;

  // Rendered in the client's default order so the server markup matches what
  // LibraryGrid shows before it reads the stored preference. Only the fields
  // the card draws cross to the client — the rest of the row stays here.
  const visible: LibraryCard[] = sortEntries(
    applyFilter(entries, active),
    DEFAULT_SORT
  ).map((e) => ({
    id: e.id,
    titleRomaji: e.titleRomaji,
    titleEnglish: e.titleEnglish,
    coverImageUrl: e.coverImageUrl,
    progress: e.progress,
    totalEpisodes: e.totalEpisodes,
    lastActivityAt: e.lastActivityAt,
    anilistAddedAt: e.anilistAddedAt,
    nextAiringAt: e.nextAiringAt,
    nextAiringEpisode: e.nextAiringEpisode,
  }));

  const neverSynced = !account?.anilistSyncedAt;

  return (
    <>
      <SiteHeader active="library" />

      <main className="pb-tabbar mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-2xl">
            Library
          </h1>
          <p className="text-sm text-muted tabular-nums">
            {visible.length} {visible.length === 1 ? "title" : "titles"}
          </p>
        </div>

        <AniListSync firstRun={neverSynced} />

        {entries.length > 0 ? (
          // Full-bleed and swipeable on a phone: six filters never fit across a
          // 360px screen, and a wrapped grid of chips eats the fold.
          <nav className="no-scrollbar snap-chips -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {FILTERS.map((filter) => {
              const count = countFor(filter);
              if (count === 0 && filter.key !== "all") return null;

              const isActive = filter.key === active.key;

              return (
                <Link
                  key={filter.key}
                  href={filter.key === "all" ? "/" : `/?status=${filter.key}`}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-medium",
                    "min-h-9 transition active:scale-[0.97]",
                    isActive
                      ? "border-anilist bg-anilist text-ink shadow-[0_4px_20px_-6px_var(--anilist)]"
                      : "border-edge bg-surface/40 text-muted hover:bg-surface hover:text-cream",
                  ].join(" ")}
                >
                  {filter.label}
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      isActive ? "bg-ink/20" : "bg-ink/40",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>
        ) : null}

        {visible.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-edge bg-surface/20 px-6 py-12 text-center sm:p-10">
            <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-muted">
              {neverSynced
                ? "Bringing in your AniList list…"
                : entries.length > 0
                  ? `Nothing in ${active.label.toLowerCase()}.`
                  : "Nothing here yet. Find an anime and add it to start tracking episodes."}
            </p>
            {!neverSynced && entries.length === 0 ? (
              <Link
                href="/search"
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-anilist px-6 text-sm font-semibold text-ink transition hover:brightness-110 active:scale-[0.97]"
              >
                Search anime
              </Link>
            ) : null}
          </div>
        ) : (
          <LibraryGrid entries={visible} />
        )}
      </main>
    </>
  );
}
