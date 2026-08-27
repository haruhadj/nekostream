/**
 * A minimal `Intl.RelativeTimeFormat` for Hermes, which does not ship one.
 *
 * Found on a real device: opening an anime crashed the app with
 * `TypeError: undefined cannot be used as a constructor`, because
 * `@shared/format` builds its formatter at module scope —
 * `const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" })` —
 * so merely *importing* it threw, the route module evaluated to `undefined`,
 * and expo-router then failed destructuring `ErrorBoundary` off it. Hermes has
 * `Intl.Collator` and `Intl.DateTimeFormat` (the Library and Schedule tabs
 * prove it), just not this one.
 *
 * Scope is deliberately exactly what `@shared/format` asks for: locale `en`,
 * `numeric: "auto"`, and the seven units its `DIVISIONS` table uses. It is not
 * a general implementation and does not pretend to be — anything beyond that
 * falls back to the plain "in N units" / "N units ago" shape rather than
 * silently producing something wrong.
 *
 * Kept separate from `polyfills.ts` so it can be run and checked off-device
 * against Node's real `Intl`.
 */

type Unit = Intl.RelativeTimeFormatUnit;

/** What English says instead of "1 day ago" / "in 1 day" under numeric:"auto". */
const NAMED: Partial<Record<string, Record<number, string>>> = {
  second: { 0: "now" },
  minute: { 0: "this minute", [-1]: "1 minute ago", 1: "in 1 minute" },
  hour: { 0: "this hour", [-1]: "1 hour ago", 1: "in 1 hour" },
  day: { 0: "today", [-1]: "yesterday", 1: "tomorrow" },
  week: { 0: "this week", [-1]: "last week", 1: "next week" },
  month: { 0: "this month", [-1]: "last month", 1: "next month" },
  year: { 0: "this year", [-1]: "last year", 1: "next year" },
};

/** "days" -> "day": callers may pass either form. */
function singular(unit: Unit): string {
  return String(unit).replace(/s$/, "");
}

export function formatRelativeTime(value: number, unit: Unit): string {
  const base = singular(unit);
  const named = NAMED[base]?.[value];
  if (named !== undefined) return named;

  const magnitude = Math.abs(value);
  const plural = magnitude === 1 ? base : `${base}s`;

  return value < 0
    ? `${magnitude} ${plural} ago`
    : `in ${magnitude} ${plural}`;
}

/** The shape `@shared/format` constructs and calls. */
export class RelativeTimeFormatShim {
  format(value: number, unit: Unit): string {
    return formatRelativeTime(value, unit);
  }
}
