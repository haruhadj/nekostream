/**
 * The background job that keeps episode lists current.
 *
 * It is deliberately lazy. A show is only asked about on Nyaa inside the window
 * that opens after AniList says its next episode aired, and the window shuts
 * the moment that episode is found. Between broadcasts the poller sends no Nyaa
 * traffic at all for that show.
 *
 * Only entries with a saved rss_filter participate — those are the shows the
 * user actually set up a feed for.
 */

import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { episode, libraryEntry, rssFilter } from "@/db/schema";
import { airingSchedules } from "@/lib/anilist/queries";
import {
  DORMANT,
  stateAfterCheck,
  stateForAiring,
  type PollState,
} from "@/lib/airing/schedule";
import { refreshEpisodes } from "@/lib/library/refresh";

/** How often to look for work. Cheap: usually a single indexed query. */
const TICK_MS = 60_000;

/** How often to re-ask AniList for broadcast times. */
const SCHEDULE_SYNC_MS = 6 * 60 * 60_000;

/** Nyaa fetches per tick, and the pause between them. Ten shows airing at
 *  once must not become ten simultaneous requests. */
const MAX_FETCHES_PER_TICK = 10;
const NYAA_GAP_MS = 3_000;

const log = (message: string, extra?: unknown) =>
  extra === undefined
    ? console.log(`[airing] ${message}`)
    : console.log(`[airing] ${message}`, extra);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function applyPollState(libraryEntryId: string, state: PollState) {
  await db
    .update(rssFilter)
    .set({
      pollNextAt: state.nextAt,
      pollTargetEpisode: state.targetEpisode,
      pollAttempts: state.attempts,
    })
    .where(eq(rssFilter.libraryEntryId, libraryEntryId));
}

/**
 * Refresh broadcast times from AniList, and arm or disarm each feed
 * accordingly. Runs at most every SCHEDULE_SYNC_MS.
 *
 * This covers the *whole* library, not just entries with a feed: the library
 * and detail pages show an airing countdown for anything still releasing, and
 * that should not depend on whether a downloader was ever configured. Arming a
 * poll is the part that requires a feed.
 */
async function syncSchedules(now: Date) {
  const stale = new Date(now.getTime() - SCHEDULE_SYNC_MS);

  const rows = await db
    .select({
      id: libraryEntry.id,
      anilistMediaId: libraryEntry.anilistMediaId,
      syncedAt: libraryEntry.airingSyncedAt,
      targetEpisode: rssFilter.pollTargetEpisode,
      hasFeed: rssFilter.id,
    })
    .from(libraryEntry)
    .leftJoin(rssFilter, eq(rssFilter.libraryEntryId, libraryEntry.id));

  const due = rows.filter((r) => r.syncedAt === null || r.syncedAt < stale);
  if (due.length === 0) return;

  const schedules = await airingSchedules(due.map((r) => r.anilistMediaId));
  const byMediaId = new Map(schedules.map((s) => [s.anilistMediaId, s]));

  let armed = 0;
  for (const row of due) {
    // An id AniList did not return is treated as "no longer airing" rather
    // than left stale, so a delisted show stops being polled.
    const schedule = byMediaId.get(row.anilistMediaId) ?? {
      nextAiringAt: null,
      nextAiringEpisode: null,
    };

    await db
      .update(libraryEntry)
      .set({
        nextAiringAt: schedule.nextAiringAt,
        nextAiringEpisode: schedule.nextAiringEpisode,
        airingSyncedAt: now,
      })
      .where(eq(libraryEntry.id, row.id));

    if (row.hasFeed === null) continue;

    const state = stateForAiring({
      airingAt: schedule.nextAiringAt,
      episode: schedule.nextAiringEpisode,
      current: { targetEpisode: row.targetEpisode },
    });

    if (state) {
      await applyPollState(row.id, state);
      if (state !== DORMANT) armed += 1;
    }
  }

  const airing = schedules.filter((s) => s.nextAiringAt !== null).length;
  log(`schedule sync: ${due.length} checked, ${airing} airing, ${armed} armed`);
}

/** Did the feed we just pulled actually contain the episode we are waiting for? */
async function hasEpisode(libraryEntryId: string, episodeNumber: number) {
  const [row] = await db
    .select({ id: episode.id })
    .from(episode)
    .where(
      and(
        eq(episode.libraryEntryId, libraryEntryId),
        eq(episode.episodeNumber, episodeNumber)
      )
    )
    .limit(1);

  return row !== undefined;
}

/** Pull the feeds whose window is open, one at a time. */
async function pollDueFeeds(now: Date) {
  const due = await db
    .select({
      libraryEntryId: rssFilter.libraryEntryId,
      targetEpisode: rssFilter.pollTargetEpisode,
      attempts: rssFilter.pollAttempts,
      title: libraryEntry.titleRomaji,
      airingAt: libraryEntry.nextAiringAt,
    })
    .from(rssFilter)
    .innerJoin(libraryEntry, eq(libraryEntry.id, rssFilter.libraryEntryId))
    .where(
      and(isNotNull(rssFilter.pollNextAt), lte(rssFilter.pollNextAt, now))
    )
    .orderBy(sql`${rssFilter.pollNextAt} asc`)
    .limit(MAX_FETCHES_PER_TICK);

  for (const [index, feed] of due.entries()) {
    // Armed without the facts to reason about it — shouldn't happen, but
    // disarm rather than loop on it forever.
    if (feed.targetEpisode === null || feed.airingAt === null) {
      await applyPollState(feed.libraryEntryId, DORMANT);
      continue;
    }

    if (index > 0) await sleep(NYAA_GAP_MS);

    try {
      const result = await refreshEpisodes(feed.libraryEntryId);
      const found = await hasEpisode(feed.libraryEntryId, feed.targetEpisode);

      const state = stateAfterCheck({
        airingAt: feed.airingAt,
        targetEpisode: feed.targetEpisode,
        attempts: feed.attempts,
        found,
        now,
      });
      await applyPollState(feed.libraryEntryId, state);

      log(
        found
          ? `${feed.title} ep ${feed.targetEpisode} found (+${result.added}) — sleeping until the next episode`
          : `${feed.title} ep ${feed.targetEpisode} not up yet${state.nextAt ? `, retry ${state.nextAt.toISOString()}` : ", gave up"}`
      );
    } catch (error) {
      // One unreachable feed must never stop the others. Count it as an
      // attempt so a persistently broken feed backs off instead of spinning.
      await applyPollState(
        feed.libraryEntryId,
        stateAfterCheck({
          airingAt: feed.airingAt,
          targetEpisode: feed.targetEpisode,
          attempts: feed.attempts,
          found: false,
          now,
        })
      );
      log(
        `${feed.title}: ${error instanceof Error ? error.message : "check failed"}`
      );
    }
  }
}

let running = false;

async function tick() {
  // A tick that runs long (many feeds, 3s apart) must not overlap the next.
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await syncSchedules(now);
    await pollDueFeeds(now);
  } catch (error) {
    log("tick failed", error);
  } finally {
    running = false;
  }
}

let timer: NodeJS.Timeout | null = null;

export function startPoller() {
  if (timer) return;

  timer = setInterval(() => void tick(), TICK_MS);
  // Don't hold the process open on shutdown.
  timer.unref?.();
  log(`started (tick ${TICK_MS / 1000}s)`);

  void tick();
}
