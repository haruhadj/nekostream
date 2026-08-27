/**
 * Pulling the AniList library onto the device — the port of
 * `lib/anilist/import.ts` and the throttle that `POST /api/library/sync`
 * used to apply around it.
 *
 * The throttle moves from the server to here unchanged in spirit: five
 * minutes, skippable with `force`, and the timestamp is stamped only on
 * success so a failed run retries on the next launch instead of being
 * throttled out. It lives in AsyncStorage rather than a table, because it is
 * a scalar about this device and not a fact about any anime.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { airingSchedules, viewerLibrary } from "@shared/anilist/queries";

import { getAniListToken } from "@/auth/anilist";
import {
  applyAiringSchedules,
  entriesNeedingAiring,
  libraryMediaIds,
  upsertImported,
  type ImportRow,
} from "@/db/library";

const SYNCED_AT_KEY = "nekostream:anilist-synced-at";

/** Skip a re-import when one ran recently, unless the caller forces it. */
const SYNC_THROTTLE_MS = 5 * 60_000;

/** How often to re-ask AniList for broadcast times — the poller's interval. */
const SCHEDULE_SYNC_MS = 6 * 60 * 60_000;

export type ImportOutcome =
  | { ok: true; added: number; total: number; throttled: boolean }
  | { ok: false; error: string; needsAuth: boolean };

export async function lastSyncedAt(): Promise<Date | null> {
  const raw = await AsyncStorage.getItem(SYNCED_AT_KEY);
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) ? new Date(at) : null;
}

/**
 * Mirrors the AniList lists into the device library, then refreshes broadcast
 * times for anything stale.
 *
 * The airing refresh is best-effort on purpose: it feeds the Schedule tab, and
 * failing it must not turn a successful library import into a reported
 * failure. The library is the thing the user asked for.
 */
export async function importAniListLibrary(
  { force = false } = {}
): Promise<ImportOutcome> {
  const last = await lastSyncedAt();

  if (!force && last && Date.now() - last.getTime() < SYNC_THROTTLE_MS) {
    return { ok: true, added: 0, total: 0, throttled: true };
  }

  const accessToken = await getAniListToken();
  if (!accessToken) {
    return {
      ok: false,
      needsAuth: true,
      error: "AniList is not connected.",
    };
  }

  let rows: ImportRow[];
  try {
    const entries = await viewerLibrary(accessToken);

    rows = entries.map((entry) => ({
      anilistMediaId: entry.media.id,
      malMediaId: entry.media.idMal,
      titleRomaji: entry.media.title.romaji,
      titleEnglish: entry.media.title.english,
      coverImageUrl: entry.media.coverImage?.large ?? null,
      totalEpisodes: entry.media.episodes,
      progress: entry.progress ?? 0,
      anilistStatus: entry.status,
      // AniList reports unix seconds; 0 and null both mean "never recorded",
      // and are kept as null so the sort places them last rather than
      // inventing a timestamp for them.
      lastActivityAt: entry.updatedAt ? new Date(entry.updatedAt * 1000) : null,
      anilistAddedAt: entry.createdAt ? new Date(entry.createdAt * 1000) : null,
    }));
  } catch (error) {
    return {
      ok: false,
      needsAuth: false,
      error: error instanceof Error ? error.message : "Could not reach AniList.",
    };
  }

  // Counted before the upsert, which touches existing rows too and would
  // otherwise report the whole library as newly added.
  const existing = new Set(await libraryMediaIds());
  const added = rows.filter((row) => !existing.has(row.anilistMediaId)).length;

  await upsertImported(rows);
  await AsyncStorage.setItem(SYNCED_AT_KEY, String(Date.now()));

  await refreshAiringSchedules().catch(() => {
    // Schedule data is a bonus on this path; the library import succeeded.
  });

  return { ok: true, added, total: rows.length, throttled: false };
}

/**
 * Broadcast times for anything not checked in the last six hours.
 *
 * On the server this is the poller's job, every six hours, forever. Here there
 * is no always-on process to do it, so it rides along with the import — which
 * is what keeps the Schedule tab populated between now and Phase 5's
 * background task. AniList needs no token for this: it is public data.
 */
export async function refreshAiringSchedules(): Promise<number> {
  const stale = new Date(Date.now() - SCHEDULE_SYNC_MS);
  const entries = await entriesNeedingAiring(stale);
  if (entries.length === 0) return 0;

  // airingSchedules() chunks by 50 and pauses between chunks by itself — the
  // rate-limit politeness is in the shared module, not re-implemented here.
  const schedules = await airingSchedules(
    entries.map((entry) => entry.anilistMediaId)
  );

  await applyAiringSchedules(entries, schedules, new Date());
  return entries.length;
}
