/**
 * Comparing an AniList list against a MyAnimeList list.
 *
 * Pure functions only — no network, no database. The route fetches both sides
 * and hands them here, which keeps the conflict rules testable and means a dry
 * run and a real run compute the plan exactly the same way.
 */

/** The shared vocabulary. Both trackers map onto this, neither drives it. */
export type MirrorStatus =
  "watching" | "planning" | "completed" | "dropped" | "paused" | "repeating";

const ANILIST_TO_MIRROR: Record<string, MirrorStatus> = {
  CURRENT: "watching",
  PLANNING: "planning",
  COMPLETED: "completed",
  DROPPED: "dropped",
  PAUSED: "paused",
  REPEATING: "repeating",
};

const MAL_TO_MIRROR: Record<string, MirrorStatus> = {
  watching: "watching",
  plan_to_watch: "planning",
  completed: "completed",
  dropped: "dropped",
  on_hold: "paused",
};

export const MIRROR_TO_ANILIST: Record<MirrorStatus, string> = {
  watching: "CURRENT",
  planning: "PLANNING",
  completed: "COMPLETED",
  dropped: "DROPPED",
  paused: "PAUSED",
  repeating: "REPEATING",
};

/**
 * MAL has no "repeating" status — a rewatch is `watching` plus the
 * is_rewatching flag, so the flag carries what the status cannot.
 */
export const MIRROR_TO_MAL: Record<
  MirrorStatus,
  { status: string; isRewatching: boolean }
> = {
  watching: { status: "watching", isRewatching: false },
  planning: { status: "plan_to_watch", isRewatching: false },
  completed: { status: "completed", isRewatching: false },
  dropped: { status: "dropped", isRewatching: false },
  paused: { status: "on_hold", isRewatching: false },
  repeating: { status: "watching", isRewatching: true },
};

export function fromAniListStatus(status: string | null): MirrorStatus | null {
  return status ? (ANILIST_TO_MIRROR[status] ?? null) : null;
}

export function fromMalStatus(
  status: string,
  isRewatching: boolean
): MirrorStatus | null {
  if (isRewatching && status === "watching") return "repeating";
  return MAL_TO_MIRROR[status] ?? null;
}

export type MirrorSide = {
  progress: number;
  status: MirrorStatus | null;
  updatedAt: Date | null;
};

export type AniListItem = MirrorSide & {
  anilistMediaId: number;
  malMediaId: number | null;
  title: string;
  totalEpisodes: number | null;
};

export type MalItem = MirrorSide & {
  malMediaId: number;
  title: string;
};

/** What differs about one anime. */
export type Difference = "progress" | "status" | "missing";

export type MirrorRow = {
  /** Stable key for the UI and for matching a decision back on apply. */
  key: string;
  title: string;
  anilistMediaId: number | null;
  malMediaId: number | null;
  totalEpisodes: number | null;
  anilist: MirrorSide | null;
  mal: MirrorSide | null;
  differences: Difference[];
  /**
   * What each rule would pick, precomputed so the UI can offer them as
   * one-click suggestions without re-deriving the logic client-side.
   */
  suggestion: Side;
};

/** Which tracker's values to copy to the other. */
export type Side = "anilist" | "mal";

export type MirrorPlan = {
  /** Rows needing a decision — the only thing the user is asked about. */
  rows: MirrorRow[];
  /** Anime whose progress and status already agree. */
  inSyncCount: number;
  /** On AniList but with no MAL id at all, so they can never be mirrored. */
  unmappable: { title: string; anilistMediaId: number }[];
};

/**
 * Suggests, never decides. Higher progress wins because episodes watched is
 * the value a user is most likely to have lost track of; timestamps only break
 * the tie, and only when both sides actually reported one — AniList leaves
 * updatedAt at zero for entries it has never recorded a change on, which is a
 * large fraction of an older list.
 */
function suggest(anilist: MirrorSide | null, mal: MirrorSide | null): Side {
  if (!mal) return "anilist";
  if (!anilist) return "mal";

  if (anilist.progress !== mal.progress) {
    return anilist.progress > mal.progress ? "anilist" : "mal";
  }

  const a = anilist.updatedAt?.getTime() ?? 0;
  const m = mal.updatedAt?.getTime() ?? 0;
  if (a !== m) return a > m ? "anilist" : "mal";

  return "anilist";
}

function differencesBetween(
  anilist: MirrorSide | null,
  mal: MirrorSide | null
): Difference[] {
  if (!anilist || !mal) return ["missing"];

  const differences: Difference[] = [];
  if (anilist.progress !== mal.progress) differences.push("progress");
  if (anilist.status !== mal.status) differences.push("status");
  return differences;
}

/**
 * Pairs the two lists on MAL id — the only identifier they share. AniList
 * supplies it as media.idMal, so no title matching is involved anywhere.
 */
export function buildMirrorPlan(
  anilistItems: AniListItem[],
  malItems: MalItem[]
): MirrorPlan {
  const malById = new Map(malItems.map((m) => [m.malMediaId, m]));
  const seenMal = new Set<number>();

  const rows: MirrorRow[] = [];
  const unmappable: { title: string; anilistMediaId: number }[] = [];
  let inSyncCount = 0;

  for (const item of anilistItems) {
    if (item.malMediaId === null) {
      unmappable.push({
        title: item.title,
        anilistMediaId: item.anilistMediaId,
      });
      continue;
    }

    const mal = malById.get(item.malMediaId) ?? null;
    if (mal) seenMal.add(item.malMediaId);

    const anilistSide: MirrorSide = {
      progress: item.progress,
      status: item.status,
      updatedAt: item.updatedAt,
    };
    const malSide = mal
      ? { progress: mal.progress, status: mal.status, updatedAt: mal.updatedAt }
      : null;

    const differences = differencesBetween(anilistSide, malSide);
    if (differences.length === 0) {
      inSyncCount++;
      continue;
    }

    rows.push({
      key: `mal:${item.malMediaId}`,
      title: item.title,
      anilistMediaId: item.anilistMediaId,
      malMediaId: item.malMediaId,
      totalEpisodes: item.totalEpisodes,
      anilist: anilistSide,
      mal: malSide,
      differences,
      suggestion: suggest(anilistSide, malSide),
    });
  }

  // Anything left is on MAL but absent from AniList — the direction the app
  // has never been able to see until now.
  for (const mal of malItems) {
    if (seenMal.has(mal.malMediaId)) continue;

    rows.push({
      key: `mal:${mal.malMediaId}`,
      title: mal.title,
      anilistMediaId: null,
      malMediaId: mal.malMediaId,
      totalEpisodes: null,
      anilist: null,
      mal: {
        progress: mal.progress,
        status: mal.status,
        updatedAt: mal.updatedAt,
      },
      differences: ["missing"],
      suggestion: "mal",
    });
  }

  // Most-different first: the rows worth a human's attention are the ones where
  // the two trackers disagree the most, not whatever sorts alphabetically.
  rows.sort((a, b) => {
    const gap = (r: MirrorRow) =>
      r.anilist && r.mal ? Math.abs(r.anilist.progress - r.mal.progress) : 1e9;
    return gap(b) - gap(a) || a.title.localeCompare(b.title);
  });

  return { rows, inSyncCount, unmappable };
}
