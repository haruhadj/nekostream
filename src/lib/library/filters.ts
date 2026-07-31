/**
 * The library's categories, shared by the web UI's tabs and the Stremio
 * addon's catalogs so the two can't drift apart.
 *
 * AniList splits a list per status; "Watching" folds in REPEATING because a
 * rewatch is still something the user is actively working through.
 */
export type LibraryFilter = {
  key: string;
  label: string;
  /** Null means "no filter" — the All tab. */
  match: string[] | null;
  /** Entries with both sync flags off, regardless of anilistStatus. */
  untracked?: boolean;
};

export const FILTERS: LibraryFilter[] = [
  { key: "all", label: "All", match: null },
  { key: "watching", label: "Watching", match: ["CURRENT", "REPEATING"] },
  { key: "planning", label: "Planning", match: ["PLANNING"] },
  { key: "completed", label: "Completed", match: ["COMPLETED"] },
  { key: "paused", label: "Paused", match: ["PAUSED"] },
  { key: "dropped", label: "Dropped", match: ["DROPPED"] },
  { key: "untracked", label: "Untracked", match: null, untracked: true },
];

/** The fields a filter reads — anything row-shaped with these will do. */
type Filterable = {
  anilistStatus: string | null;
  syncAnilist: boolean;
  syncMal: boolean;
};

export function applyFilter<T extends Filterable>(
  entries: T[],
  filter: LibraryFilter
): T[] {
  if (filter.untracked) {
    return entries.filter((e) => !e.syncAnilist && !e.syncMal);
  }
  const match = filter.match;
  if (match === null) return entries;
  return entries.filter(
    (e) => e.anilistStatus !== null && match.includes(e.anilistStatus)
  );
}
