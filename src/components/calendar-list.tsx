"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { useNow } from "@/components/airing-countdown";
import { groupByDay } from "@/lib/calendar/group";

export type CalendarItem = {
  id: string;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  nextAiringAt: string;
  nextAiringEpisode: number;
  /** Whether a Nyaa feed is saved, and so whether anything is actually looking. */
  hasFeed: boolean;
};

const TIME_FORMAT = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit",
});

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
  entry: CalendarItem & { airingAt: Date };
  airingNext: boolean;
  now: number;
}) {
  const hasAired = entry.airingAt.getTime() <= now;

  return (
    <li className="relative">
      {airingNext ? (
        <Badge className="absolute -top-2 left-3 z-10 bg-accent text-accent-foreground">
          Airing Next
        </Badge>
      ) : null}
      <Link
        href={`/anime/${entry.id}`}
        className="flex h-full items-center gap-3 rounded-xl border border-border bg-surface/30 p-3 transition hover:border-accent/50 active:scale-[0.99]"
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
          <p className="mt-1 text-xs text-muted">
            Ep {entry.nextAiringEpisode} {hasAired ? "aired" : "airing"} at{" "}
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
 * Grouped by day, in the viewer's local time — see lib/calendar/group.ts.
 * Like AiringBadge/AiringCountdown, this renders nothing until mounted: day
 * labels ("Today", "Tomorrow", ...) and the aired/airing split both depend on
 * the viewer's clock, which the server render cannot know without risking a
 * hydration mismatch.
 */
export function CalendarList({ entries }: { entries: CalendarItem[] }) {
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
