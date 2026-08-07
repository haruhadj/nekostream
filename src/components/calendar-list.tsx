"use client";

import Link from "next/link";
import { Fragment } from "react";

import { AiringCountdown, useNow } from "@/components/airing-countdown";
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Google-Calendar-style "now" line: only meaningful within today's section,
 * since that's the only day where some entries are in the past and some are
 * still ahead. Marks the exact split point in an already-ascending list.
 */
function NowDivider({ now }: { now: Date }) {
  return (
    <li className="flex items-center gap-2" role="separator" aria-label="Current time">
      <span className="h-px flex-1 bg-anilist/60" />
      <span className="shrink-0 rounded-full bg-anilist px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink tabular-nums">
        Now ·{" "}
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
      <span className="h-px flex-1 bg-anilist/60" />
    </li>
  );
}

/**
 * Grouped by day, in the viewer's local time — see lib/calendar/group.ts.
 * Like AiringBadge/AiringCountdown, this renders nothing until mounted: the
 * group labels ("Today", "Tomorrow", ...) depend on the viewer's clock, which
 * the server render cannot know without risking a hydration mismatch.
 */
export function CalendarList({ entries }: { entries: CalendarItem[] }) {
  const now = useNow();
  if (now === null) return null;

  const nowDate = new Date(now);
  const today = startOfDay(nowDate);
  const groups = groupByDay(
    entries.map((entry) => ({ ...entry, airingAt: new Date(entry.nextAiringAt) })),
    nowDate
  );

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group) => {
        const isToday = group.date.getTime() === today.getTime();
        const nowIndex = isToday
          ? group.entries.findIndex((entry) => entry.airingAt.getTime() > now)
          : -1;
        const splitIndex = isToday
          ? nowIndex === -1
            ? group.entries.length
            : nowIndex
          : -1;

        return (
          <section key={group.date.getTime()}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              {group.label}
            </h2>

            <ul className="mt-3 flex flex-col gap-2">
              {group.entries.map((entry, index) => (
                <Fragment key={entry.id}>
                  {index === splitIndex ? <NowDivider now={nowDate} /> : null}
                  <li>
                    <Link
                      href={`/anime/${entry.id}`}
                      className="flex items-center gap-3 rounded-xl border border-edge bg-surface/30 p-3 transition hover:border-anilist/50 active:scale-[0.99]"
                    >
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface">
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
                        <p className="truncate text-sm font-medium text-cream">
                          {entry.titleEnglish ?? entry.titleRomaji}
                        </p>
                        <AiringCountdown
                          episodeNumber={entry.nextAiringEpisode}
                          airingAt={entry.nextAiringAt}
                          polling={entry.hasFeed}
                        />
                      </div>
                    </Link>
                  </li>
                </Fragment>
              ))}
              {splitIndex === group.entries.length ? (
                <NowDivider now={nowDate} />
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
