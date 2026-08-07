/**
 * Groups upcoming-episode entries into calendar days, in the viewer's local
 * time zone.
 *
 * Pure and clock-free, like lib/airing/schedule.ts: `now` is always passed in
 * rather than read internally, so the label a group gets ("Today",
 * "Tomorrow", ...) is deterministic and testable. The caller is expected to
 * hand entries in ascending airingAt order — that order is preserved, not
 * re-sorted, so groups come out chronological for free.
 */

export type CalendarEntry = { airingAt: Date };

export type CalendarGroup<T extends CalendarEntry> = {
  label: string;
  date: Date;
  entries: T[];
};

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "long" });
const MONTH_DAY = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DAY_MS = 24 * 60 * 60_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayLabel(day: Date, today: Date): string {
  const diffDays = Math.round((day.getTime() - today.getTime()) / DAY_MS);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return WEEKDAY.format(day);

  return day.getFullYear() === today.getFullYear()
    ? MONTH_DAY.format(day)
    : MONTH_DAY_YEAR.format(day);
}

export function groupByDay<T extends CalendarEntry>(
  entries: T[],
  now: Date
): CalendarGroup<T>[] {
  const today = startOfDay(now);
  const groups: CalendarGroup<T>[] = [];
  const byKey = new Map<number, CalendarGroup<T>>();

  for (const entry of entries) {
    const day = startOfDay(entry.airingAt);
    const key = day.getTime();

    let group = byKey.get(key);
    if (!group) {
      group = { label: dayLabel(day, today), date: day, entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }

    group.entries.push(entry);
  }

  return groups;
}
