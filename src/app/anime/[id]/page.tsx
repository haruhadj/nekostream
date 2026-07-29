import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { EntrySettings } from "@/components/entry-settings";
import { EpisodeList } from "@/components/episode-list";
import { NyaaFilterPanel } from "@/components/nyaa-filter-panel";
import { ProgressControl, ProgressProvider } from "@/components/progress-control";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { account, episode, libraryEntry, rssFilter } from "@/db/schema";
import { AniListError } from "@/lib/anilist/client";
import { mediaById } from "@/lib/anilist/queries";
import { auth } from "@/lib/auth";
import { stripHtml } from "@/lib/format";

export default async function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [entry] = await db
    .select()
    .from(libraryEntry)
    .where(
      and(eq(libraryEntry.id, id), eq(libraryEntry.userId, session.user.id))
    )
    .limit(1);

  if (!entry) notFound();

  const [[filter], episodes, malAccounts] = await Promise.all([
    db
      .select()
      .from(rssFilter)
      .where(eq(rssFilter.libraryEntryId, entry.id))
      .limit(1),
    db
      .select()
      .from(episode)
      .where(eq(episode.libraryEntryId, entry.id))
      .orderBy(desc(episode.episodeNumber), desc(episode.publishedAt)),
    db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, session.user.id), eq(account.providerId, "mal"))
      )
      .limit(1),
  ]);

  // Extra metadata is a nicety — the page must still render if AniList is down.
  let description: string | null = null;
  let genres: string[] = [];
  try {
    const media = await mediaById(entry.anilistMediaId);
    description = stripHtml(media?.description ?? null);
    genres = media?.genres ?? [];
  } catch (error) {
    if (!(error instanceof AniListError)) throw error;
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Link
          href="/"
          className="text-xs text-muted transition-colors hover:text-cream"
        >
          ← Library
        </Link>

        <ProgressProvider
          entryId={entry.id}
          initialProgress={entry.progress}
          totalEpisodes={entry.totalEpisodes}
        >
        <div className="mt-5 flex flex-col gap-6 sm:flex-row">
          <div className="w-36 shrink-0 overflow-hidden rounded-xl border border-edge bg-surface">
            {entry.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.coverImageUrl}
                alt=""
                className="aspect-[2/3] w-full object-cover"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-balance">
              {entry.titleEnglish ?? entry.titleRomaji}
            </h1>
            {entry.titleEnglish ? (
              <p className="mt-1 text-sm text-muted">{entry.titleRomaji}</p>
            ) : null}

            {genres.length > 0 ? (
              <p className="mt-2 text-xs text-muted">{genres.join(" · ")}</p>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              <ProgressControl />
              <EntrySettings
                entryId={entry.id}
                syncAnilist={entry.syncAnilist}
                syncMal={entry.syncMal}
                malLinked={malAccounts.length > 0}
              />
            </div>
          </div>
        </div>

        {description ? (
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}

        <div className="mt-9">
          <NyaaFilterPanel
            entryId={entry.id}
            defaultTitle={entry.titleRomaji}
            savedFilter={filter ?? null}
          />
        </div>

        <EpisodeList
          entryId={entry.id}
          hasFilter={Boolean(filter)}
          lastFetchedAt={filter?.lastFetchedAt?.toISOString() ?? null}
          episodes={episodes.map((ep) => ({
            id: ep.id,
            episodeNumber: ep.episodeNumber,
            rawTitle: ep.rawTitle,
            releaseGroup: ep.releaseGroup,
            quality: ep.quality,
            magnetUri: ep.magnetUri,
            sizeBytes: ep.sizeBytes,
            seeders: ep.seeders,
            publishedAt: ep.publishedAt?.toISOString() ?? null,
          }))}
        />
        </ProgressProvider>
      </main>
    </>
  );
}
