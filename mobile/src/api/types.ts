/**
 * Response types mirroring the server routes (src/server/*-routes.ts). Grown
 * phase by phase as each screen starts calling a new endpoint — this is
 * deliberately not a full mirror of the API surface yet.
 *
 * These are re-declared rather than imported from `@shared/*` on purpose. The
 * server's own versions of these shapes live in modules that import `db` or
 * the AniList client (`lib/library/schedule.ts`, `lib/anilist/queries.ts`),
 * which `../context/architecture.md` forbids this app from reaching into. Only
 * the four dependency-free modules cross that line; the wire format does not.
 *
 * JSON serialises the timestamp columns as ISO strings, so every `*Response`
 * below is the raw wire shape and each `parse*` returns the same thing with
 * real `Date` objects — which is what the shared sort/grouping helpers
 * (`@shared/library/sort`, `@shared/schedule/group`) take.
 */

/** GET /api/health — used by the server-url screen to validate a host. */
export type HealthResponse = {
  ok: true;
  service: "nekostream";
};

/* ------------------------------------------------------------------ *
 * Library
 * ------------------------------------------------------------------ */

/** One row of `library_entry`, as `GET /api/library` sends it. */
export type LibraryEntryResponse = {
  id: string;
  anilistMediaId: number;
  malMediaId: number | null;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  totalEpisodes: number | null;
  progress: number;
  anilistStatus: string | null;
  lastActivityAt: string | null;
  anilistAddedAt: string | null;
  nextAiringAt: string | null;
  nextAiringEpisode: number | null;
  syncAnilist: boolean;
  syncMal: boolean;
};

export type LibraryEntry = Omit<
  LibraryEntryResponse,
  "lastActivityAt" | "anilistAddedAt" | "nextAiringAt"
> & {
  lastActivityAt: Date | null;
  anilistAddedAt: Date | null;
  nextAiringAt: Date | null;
};

export type LibraryResponse = { entries: LibraryEntryResponse[] };

/** An absent or unparseable timestamp is "unknown", which the sorts handle. */
function toDate(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseLibraryEntry(row: LibraryEntryResponse): LibraryEntry {
  return {
    ...row,
    lastActivityAt: toDate(row.lastActivityAt),
    anilistAddedAt: toDate(row.anilistAddedAt),
    nextAiringAt: toDate(row.nextAiringAt),
  };
}

/** POST /api/library/sync */
export type SyncResponse = {
  added: number;
  skipped: number;
  total: number;
  throttled: boolean;
};

/* ------------------------------------------------------------------ *
 * Schedule
 * ------------------------------------------------------------------ */

/** GET /api/library/schedule — `nextAiringAt` is never null here by design. */
export type ScheduleItemResponse = {
  id: string;
  titleRomaji: string;
  titleEnglish: string | null;
  coverImageUrl: string | null;
  nextAiringAt: string;
  nextAiringEpisode: number;
  progress: number;
  totalEpisodes: number | null;
  hasFeed: boolean;
};

/** `airingAt` is what `groupByDay` reads; the rest is what the card draws. */
export type ScheduleItem = ScheduleItemResponse & { airingAt: Date };

export type ScheduleResponse = { entries: ScheduleItemResponse[] };

export function parseScheduleItem(row: ScheduleItemResponse): ScheduleItem {
  return { ...row, airingAt: new Date(row.nextAiringAt) };
}

/* ------------------------------------------------------------------ *
 * AniList search
 * ------------------------------------------------------------------ */

/** The subset of `AniListMedia` the search screen actually draws. */
export type AniListMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null };
  coverImage: { large: string | null } | null;
  episodes: number | null;
  format: string | null;
  seasonYear: number | null;
};

export type SearchResponse = {
  query: string;
  media: AniListMedia[];
  pageInfo: { total: number; currentPage: number; hasNextPage: boolean };
};

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

/** GET/PATCH /api/settings — the same shape from both. */
export type SettingsResponse = {
  notificationEmail: string | null;
  notifyNewEpisodesByEmail: boolean;
  emailConfigured: boolean;
  anilistLinked: boolean;
  malLinked: boolean;
  /** ISO, or null when the AniList library has never been imported. */
  anilistSyncedAt: string | null;
};
