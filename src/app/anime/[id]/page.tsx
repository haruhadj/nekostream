import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { AiringCountdown } from "@/components/airing-countdown";
import { TrackerEditors } from "@/components/tracker-editor";
import { EpisodeList } from "@/components/episode-list";
import { NyaaFilterPanel } from "@/components/nyaa-filter-panel";
import {
  ProgressControl,
  ProgressProvider,
} from "@/components/progress-control";
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
  // Read live rather than from the row the poller maintains: the countdown is
  // useful for any releasing show, whether or not a Nyaa feed was ever set up.
  let nextAiring: { episode: number; airingAt: Date } | null =
    entry.nextAiringAt && entry.nextAiringEpisode
      ? { episode: entry.nextAiringEpisode, airingAt: entry.nextAiringAt }
      : null;
  try {
    const media = await mediaById(entry.anilistMediaId);
    description = stripHtml(media?.description ?? null);
    genres = media?.genres ?? [];
    nextAiring = media?.nextAiringEpisode
      ? {
          episode: media.nextAiringEpisode.episode,
          airingAt: new Date(media.nextAiringEpisode.airingAt * 1000),
        }
      : null;
  } catch (error) {
    if (!(error instanceof AniListError)) throw error;
  }

  return (
    <>
      <SiteHeader />

      <main className="pb-tabbar mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6 sm:pt-8">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-full px-2 text-xs text-muted transition-colors hover:text-cream"
        >
          <span aria-hidden="true">←</span> Library
        </Link>

        <ProgressProvider
          entryId={entry.id}
          initialProgress={entry.progress}
          totalEpisodes={entry.totalEpisodes}
        >
          {/* Cover beside the title even on a phone: stacking pushed everything
            that matters — progress, sync, episodes — below the fold. */}
          <div className="mt-3 flex flex-row gap-4 sm:mt-5 sm:gap-6">
            <div className="w-28 shrink-0 self-start overflow-hidden rounded-2xl border border-edge bg-surface shadow-xl shadow-ink/60 ring-1 ring-inset ring-white/5 sm:w-36">
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
              <h1 className="text-xl font-semibold leading-tight tracking-tight text-balance sm:text-2xl">
                {entry.titleEnglish ?? entry.titleRomaji}
              </h1>
              {entry.titleEnglish ? (
                <p className="mt-1 text-sm text-muted">{entry.titleRomaji}</p>
              ) : null}

              {genres.length > 0 ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <li
                      key={genre}
                      className="rounded-full border border-edge bg-surface/50 px-2.5 py-0.5 text-[11px] text-muted"
                    >
                      {genre}
                    </li>
                  ))}
                </ul>
              ) : null}

              {nextAiring ? (
                <AiringCountdown
                  episodeNumber={nextAiring.episode}
                  airingAt={nextAiring.airingAt.toISOString()}
                  polling={filter !== undefined}
                />
              ) : null}
            </div>
          </div>

          {/* Full width rather than beside the cover: the controls are the reason
            this page gets opened, and the column left of them is ~200px wide on
            a phone. */}
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-edge bg-surface/30 p-4">
            <ProgressControl />
            <TrackerEditors
              entryId={entry.id}
              malAvailable={malAccounts.length > 0 && entry.malMediaId !== null}
              syncAnilist={entry.syncAnilist}
              syncMal={entry.syncMal}
            />
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
