"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { useNow } from "@/components/airing-countdown";
import { cn } from "@/lib/cn";
import { groupByDay } from "@/lib/schedule/group";
import type { ScheduleItem } from "@/lib/library/schedule";

const TIME_FORMAT = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Watched against aired, on one scale: the accent fill is what has been
 * watched, the amber behind it is what has aired and hasn't. The gap between
 * the two ends is the backlog, readable without counting.
 */
function EpisodeBar({
  watched,
  aired,
  total,
}: {
  watched: number;
  aired: number;
  total: number;
}) {
  const width = (episodes: number) =>
    `${Math.min((episodes / total) * 100, 100)}%`;

  return (
    <div
      aria-hidden="true"
      className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-border"
    >
      <div
        className="absolute inset-y-0 left-0 bg-amber-400/50"
        style={{ width: width(aired) }}
      />
      <div
        className="absolute inset-y-0 left-0 bg-accent"
        style={{ width: width(watched) }}
      />
    </div>
  );
}

/**
 * anichart.net-style grid card: absolute air time rather than a countdown,
 * since at-a-glance scanning across a whole day's grid is the point here —
 * relative time ("airs in 3h") stops being comparable once cards aren't in a
 * single chronological list.
 */
function ScheduleCard({
  entry,
  airingNext,
  now,
}: {
  entry: ScheduleItem & { airingAt: Date };
  airingNext: boolean;
  now: number;
}) {
  const hasAired = entry.airingAt.getTime() <= now;
  // A row tracks one episode at a time: `nextAiringEpisode` is upcoming until
  // its air time passes, after which it is itself the latest aired episode —
  // the poller only advances the row once AniList announces the following one.
  const latestAired = hasAired
    ? entry.nextAiringEpisode
    : entry.nextAiringEpisode - 1;
  // A tracker can sit ahead of AniList's airing data, so never report a
  // negative backlog.
  const unwatched = Math.max(latestAired - entry.progress, 0);
  // Without a known season length, scale the bar to what has aired: still a
  // true watched/aired split, just without the rest of the season for context.
  const barTotal = entry.totalEpisodes ?? latestAired;

  return (
    <li className="relative">
      {airingNext ? (
        <Badge className="absolute -top-2 left-3 z-10 bg-accent text-accent-foreground">
          Airing Next
        </Badge>
      ) : null}
      <Link
        href={`/anime/${entry.id}`}
        className={cn(
          "flex h-full items-center gap-3 rounded-xl border bg-surface/30 p-3 transition hover:border-accent/50 active:scale-[0.99]",
          // An unwatched aired episode is the reason to open this page at all,
          // so those cards carry the signal out to their edge.
          unwatched > 0 ? "border-amber-400/30" : "border-border"
        )}
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-surface">
          {entry.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {entry.titleEnglish ?? entry.titleRomaji}
          </p>

          {latestAired > 0 ? (
            <>
              {barTotal > 0 ? (
                <EpisodeBar
                  watched={entry.progress}
                  aired={latestAired}
                  total={barTotal}
                />
              ) : null}

              {unwatched > 0 ? (
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums">
                  <span className="text-muted">Ep {entry.progress} watched</span>
                  <span className="font-semibold text-amber-300">
                    Ep {latestAired} aired
                  </span>
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted tabular-nums">
                  Caught up &mdash; Ep {latestAired} aired
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-muted">Nothing aired yet</p>
          )}

          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                hasAired ? "bg-accent" : "ring-1 ring-inset ring-muted/60"
              )}
            />
            {hasAired ? "Aired" : `Ep ${entry.nextAiringEpisode} airs`} at{" "}
            <span className="font-mono tabular-nums text-foreground/80">
              {TIME_FORMAT.format(entry.airingAt)}
            </span>
          </p>

          {hasAired && entry.hasFeed ? (
            <p className="mt-0.5 text-[11px] text-muted">
              Checking for a release
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

/**
 * Grouped by day, in the viewer's local time — see lib/schedule/group.ts.
 * Like AiringBadge/AiringCountdown, this renders nothing until mounted: day
 * labels ("Today", "Tomorrow", ...) and the aired/airing split both depend on
 * the viewer's clock, which the server render cannot know without risking a
 * hydration mismatch.
 */
export function ScheduleList({ entries }: { entries: ScheduleItem[] }) {
  const now = useNow();
  if (now === null) return null;

  const mapped = entries.map((entry) => ({ ...entry, airingAt: new Date(entry.nextAiringAt) }));
  const groups = groupByDay(mapped, new Date(now));

  // The single soonest-upcoming entry overall gets the "Airing Next" badge —
  // groupByDay preserves the caller's ascending order, so the first entry
  // past `now` in the flat list is it.
  const airingNextId = mapped.find((entry) => entry.airingAt.getTime() > now)?.id;

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.date.getTime()}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {group.label}
          </h2>

          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.entries.map((entry) => (
              <ScheduleCard
                key={entry.id}
                entry={entry}
                airingNext={entry.id === airingNextId}
                now={now}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
