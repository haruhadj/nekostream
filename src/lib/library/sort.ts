/**
 * Library sort orders. Shared between the server page (which renders the
 * default order) and the client grid (which applies the stored preference), so
 * both agree on what "title" means before hydration swaps anything around.
 */

export type SortKey =
  "title-asc" | "title-desc" | "updated" | "added" | "progress" | "remaining";

export type SortableEntry = {
  titleRomaji: string;
  titleEnglish: string | null;
  progress: number;
  totalEpisodes: number | null;
  lastActivityAt: Date | null;
  anilistAddedAt: Date | null;
};

export const SORTS: { key: SortKey; label: string }[] = [
  { key: "title-asc", label: "Title A–Z" },
  { key: "title-desc", label: "Title Z–A" },
  { key: "updated", label: "Last updated" },
  { key: "added", label: "Recently added" },
  { key: "progress", label: "Most watched" },
  { key: "remaining", label: "Most left to watch" },
];

export const DEFAULT_SORT: SortKey = "title-asc";

export function isSortKey(value: unknown): value is SortKey {
  return SORTS.some((s) => s.key === value);
}

/** What the card shows, so sorting matches the order the eye reads. */
function displayTitle(entry: SortableEntry) {
  return entry.titleEnglish ?? entry.titleRomaji;
}

/**
 * Episodes released but not yet watched. Unknown totals sort last rather than
 * counting as zero — "we don't know" is not the same as "nothing left".
 */
function remaining(entry: SortableEntry) {
  if (entry.totalEpisodes === null) return -1;
  return Math.max(0, entry.totalEpisodes - entry.progress);
}

/**
 * Newest first, with unknown timestamps last.
 *
 * There is deliberately no fallback to a local column here. AniList reports no
 * timestamp for entries it never recorded a change on, and the obvious stand-in
 * — when the row landed in our database — is the bulk import time, which is
 * newer than every genuine AniList timestamp. Substituting it buries the
 * entries the user actually touched beneath everything they never opened.
 */
function byTime(a: Date | null, b: Date | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.getTime() - a.getTime();
}

export function sortEntries<T extends SortableEntry>(
  entries: T[],
  key: SortKey
): T[] {
  // Locale pinned rather than left to the runtime: the server and the browser
  // would otherwise collate differently and the grid would reshuffle on
  // hydration even when the sort key never changed.
  const collator = new Intl.Collator("en", { sensitivity: "base" });
  // Ties fall back to title so the order is stable across renders and reloads
  // instead of drifting with whatever the database handed back.
  const byTitle = (a: T, b: T) =>
    collator.compare(displayTitle(a), displayTitle(b));

  const sorted = [...entries];

  switch (key) {
    case "title-asc":
      return sorted.sort(byTitle);
    case "title-desc":
      return sorted.sort((a, b) => byTitle(b, a));
    case "updated":
      return sorted.sort(
        (a, b) => byTime(a.lastActivityAt, b.lastActivityAt) || byTitle(a, b)
      );
    case "added":
      return sorted.sort(
        (a, b) => byTime(a.anilistAddedAt, b.anilistAddedAt) || byTitle(a, b)
      );
    case "progress":
      return sorted.sort((a, b) => b.progress - a.progress || byTitle(a, b));
    case "remaining":
      return sorted.sort(
        (a, b) => remaining(b) - remaining(a) || byTitle(a, b)
      );
  }
}
