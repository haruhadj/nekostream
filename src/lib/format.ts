export function formatBytes(bytes: number | null): string | null {
  if (bytes === null) return null;

  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const DIVISIONS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

export function formatRelative(date: Date | string | null): string | null {
  if (!date) return null;

  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return null;

  let delta = (parsed.getTime() - Date.now()) / 1000;

  for (const [unit, span] of DIVISIONS) {
    if (Math.abs(delta) < span) return RELATIVE.format(Math.round(delta), unit);
    delta /= span;
  }

  return null;
}

/** AniList descriptions carry a little inline HTML. */
export function stripHtml(text: string | null): string | null {
  return text?.replace(/<[^>]*>/g, "").trim() || null;
}
