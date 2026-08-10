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

/**
 * Google-Calendar-style "now" line, positioned by chronological order across
 * the whole (already-ascending) list — not tied to a "Today" section, since
 * a day with nothing airing gets no group at all and would otherwise leave
 * the indicator with nowhere to attach.
 */
function NowDivider({ now }: { now: Date }) {
  return (
    <li className="flex items-center gap-2" role="separator" aria-label="Current time">
      <span className="h-px flex-1 bg-accent/60" />
      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent-foreground tabular-nums">
        Now ·{" "}
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
      <span className="h-px flex-1 bg-accent/60" />
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
  const mapped = entries.map((entry) => ({ ...entry, airingAt: new Date(entry.nextAiringAt) }));
  const groups = groupByDay(mapped, nowDate);

  // Where "now" falls in the flat, chronologically-sorted entry list —
  // groupByDay preserves that order, so counting into each group reproduces
  // the same split point without needing a "Today" group to exist.
  const nowIndex = mapped.findIndex((entry) => entry.airingAt.getTime() > now);
  const splitAt = nowIndex === -1 ? mapped.length : nowIndex;

  const groupStarts = groups.reduce<number[]>((starts, group, index) => {
    starts.push(index === 0 ? 0 : starts[index - 1] + groups[index - 1].entries.length);
    return starts;
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-8">
      {groups.map((group, groupIndex) => {
        const groupStart = groupStarts[groupIndex];
        const isLastGroup = groupIndex === groups.length - 1;
        const inGroup =
          splitAt >= groupStart &&
          (splitAt < groupStart + group.entries.length ||
            (isLastGroup && splitAt === groupStart + group.entries.length));
        const splitIndex = inGroup ? splitAt - groupStart : -1;

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
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface/30 p-3 transition hover:border-accent/50 active:scale-[0.99]"
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
