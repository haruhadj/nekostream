/**
 * When to ask Nyaa for a newly-aired episode.
 *
 * AniList tells us the exact second an episode goes to air. That timestamp is
 * the whole schedule: before it, a Nyaa request cannot possibly find anything,
 * so we never send one. After it, release groups still need to encode and
 * upload — usually 20-60 minutes, occasionally hours — so we check on a
 * widening backoff instead of hammering a fixed interval.
 *
 * Pure functions only: no DB, no fetch, no clock of its own. `now` is always
 * passed in so this is testable and so one tick sees one consistent time.
 */

/** Earliest a release group realistically has the episode up. */
export const RELEASE_LAG_MS = 20 * 60_000;

/** Longest we ever wait between two checks for the same episode. */
export const MAX_BACKOFF_MS = 2 * 60 * 60_000;

/**
 * How long past air time we keep trying before writing the episode off. A
 * group this late is usually not coming today, and the next schedule sync will
 * hand us a fresh target anyway.
 */
export const GIVE_UP_MS = 12 * 60 * 60_000;

/**
 * The gap added before check number `attempts` (0-indexed). Doubles from
 * RELEASE_LAG_MS, capped, so early checks are cheap and late ones are patient.
 */
export function backoffMs(attempts: number): number {
  if (attempts <= 0) return RELEASE_LAG_MS;
  return Math.min(RELEASE_LAG_MS * 2 ** attempts, MAX_BACKOFF_MS);
}

/** The very first check for an episode: air time plus the encode/upload lag. */
export function firstCheckAt(airingAt: Date): Date {
  return new Date(airingAt.getTime() + RELEASE_LAG_MS);
}

/**
 * When to check next, given how many checks have already come up empty.
 * `attempts` of 0 means nothing has been tried yet, so this is `firstCheckAt`.
 */
export function nextPollAt({
  airingAt,
  attempts,
}: {
  airingAt: Date;
  attempts: number;
}): Date {
  let offset = RELEASE_LAG_MS;
  for (let i = 1; i <= attempts; i += 1) {
    offset += backoffMs(i - 1);
  }
  return new Date(airingAt.getTime() + offset);
}

/** True once we have waited long enough that the episode is not coming. */
export function isExhausted({
  airingAt,
  now,
}: {
  airingAt: Date;
  now: Date;
}): boolean {
  return now.getTime() - airingAt.getTime() > GIVE_UP_MS;
}

export type PollState = {
  targetEpisode: number | null;
  nextAt: Date | null;
  attempts: number;
};

/** Dormant: nothing scheduled until a new episode is announced. */
export const DORMANT: PollState = {
  targetEpisode: null,
  nextAt: null,
  attempts: 0,
};

/**
 * The poll state for a feed after AniList told us the next episode. Returns
 * null when nothing needs to change, so a schedule sync that found no news
 * writes nothing and, crucially, does not reset a backoff already in progress.
 */
export function stateForAiring({
  airingAt,
  episode,
  current,
}: {
  airingAt: Date | null;
  episode: number | null;
  current: { targetEpisode: number | null };
}): PollState | null {
  // Not releasing any more (or never was) — stand down.
  if (airingAt === null || episode === null) {
    return current.targetEpisode === null ? null : DORMANT;
  }

  if (current.targetEpisode === episode) return null;

  return { targetEpisode: episode, nextAt: firstCheckAt(airingAt), attempts: 0 };
}

/**
 * The poll state after one Nyaa check. `found` means a release for the target
 * episode is now in the database, which is the signal to stop entirely — that
 * is what keeps traffic to a handful of requests per episode.
 */
export function stateAfterCheck({
  airingAt,
  targetEpisode,
  attempts,
  found,
  now,
}: {
  airingAt: Date;
  targetEpisode: number;
  attempts: number;
  found: boolean;
  now: Date;
}): PollState {
  if (found) return DORMANT;

  const next = attempts + 1;
  if (isExhausted({ airingAt, now })) return DORMANT;

  return {
    targetEpisode,
    attempts: next,
    nextAt: nextPollAt({ airingAt, attempts: next }),
  };
}
