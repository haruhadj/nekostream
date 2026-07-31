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

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted">
            {visible.length} {visible.length === 1 ? "title" : "titles"}
          </p>
        </div>

        <AniListSync firstRun={neverSynced} />

        {entries.length > 0 ? (
          <nav className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {FILTERS.map((filter) => {
              const count = countFor(filter);
              if (count === 0 && filter.key !== "all") return null;

              return (
                <Link
                  key={filter.key}
                  href={filter.key === "all" ? "/" : `/?status=${filter.key}`}
                  aria-current={filter.key === active.key ? "page" : undefined}
                  className={[
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                    filter.key === active.key
                      ? "border-anilist bg-anilist text-ink"
                      : "border-edge text-muted hover:bg-surface hover:text-cream",
                  ].join(" ")}
                >
                  {filter.label}
                  <span className="ml-1.5 opacity-60">{count}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}

        {visible.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-edge p-10 text-center">
            <p className="text-sm text-muted">
              {neverSynced
                ? "Bringing in your AniList list…"
                : entries.length > 0
                  ? `Nothing in ${active.label.toLowerCase()}.`
                  : "Nothing here yet. Find an anime and add it to start tracking episodes."}
            </p>
            {!neverSynced && entries.length === 0 ? (
              <Link
                href="/search"
                className="mt-5 inline-block rounded-xl bg-anilist px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
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
