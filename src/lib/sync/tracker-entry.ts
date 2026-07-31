/**
 * Reading and writing one anime's entry on a single tracker.
 *
 * lib/sync/progress.ts pushes progress to both trackers at once as a side
 * effect of watching an episode. This is the other mode: the user opening one
 * tracker's entry deliberately and overriding any field on it.
 */

import { anilistRequest } from "@/lib/anilist/client";
import { malFetch } from "@/lib/mal/client";
import {
  fromAniListStatus,
  fromMalStatus,
  MIRROR_TO_ANILIST,
  MIRROR_TO_MAL,
  type MirrorStatus,
} from "@/lib/sync/mirror";

export type TrackerEntry = {
  /** Null when the anime is not on this tracker's list at all. */
  exists: boolean;
  progress: number;
  status: MirrorStatus | null;
  /** 0–10 on both trackers once AniList's POINT_10 scale is applied. */
  score: number;
  totalEpisodes: number | null;
};

export async function readAniListEntry(
  accessToken: string,
  mediaId: number
): Promise<TrackerEntry> {
  const data = await anilistRequest<{
    Media: {
      episodes: number | null;
      mediaListEntry: {
        progress: number | null;
        status: string | null;
        score: number | null;
      } | null;
    } | null;
  }>(
    `query ($id: Int) {
       Media(id: $id, type: ANIME) {
         episodes
         mediaListEntry { progress status score(format: POINT_10) }
       }
     }`,
    { id: mediaId },
    { accessToken }
  );

  const entry = data.Media?.mediaListEntry ?? null;

  return {
    exists: entry !== null,
    progress: entry?.progress ?? 0,
    status: fromAniListStatus(entry?.status ?? null),
    score: entry?.score ?? 0,
    totalEpisodes: data.Media?.episodes ?? null,
  };
}

/**
 * Values to write to a tracker.
 *
 * Score is optional, and the distinction matters: marking an episode watched
 * and mirroring two lists both write progress and status only. Sending a score
 * on those paths would overwrite whatever the user had rated the show.
 */
export type TrackerWrite = {
  progress: number;
  status: MirrorStatus;
  score?: number;
  /**
   * Leaves MyAnimeList's is_rewatching flag untouched. Set when the status was
   * derived from episode count rather than chosen by the user: ticking an
   * episode during a rewatch must not be what ends the rewatch.
   */
  keepRewatchFlag?: boolean;
};

export async function writeAniListEntry(
  accessToken: string,
  mediaId: number,
  values: TrackerWrite
) {
  const withScore = values.score !== undefined;

  await anilistRequest(
    withScore
      ? `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Int) {
       SaveMediaListEntry(
         mediaId: $mediaId, progress: $progress, status: $status, scoreRaw: $score
       ) { id }
     }`
      : `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
       SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) { id }
     }`,
    {
      mediaId,
      progress: values.progress,
      status: MIRROR_TO_ANILIST[values.status],
      // scoreRaw is always on the 100-point scale regardless of the user's
      // display preference, so a 0-10 score has to be widened here.
      ...(withScore ? { score: values.score! * 10 } : {}),
    },
    { accessToken }
  );
}

export async function readMalEntry(
  accessToken: string,
  malMediaId: number
): Promise<TrackerEntry> {
  const response = await malFetch(
    accessToken,
    `https://api.myanimelist.net/v2/anime/${malMediaId}?fields=num_episodes,my_list_status`
  );

  const json = (await response.json()) as {
    num_episodes?: number;
    my_list_status?: {
      status?: string;
      num_episodes_watched?: number;
      is_rewatching?: boolean;
      score?: number;
    };
  };

  const listStatus = json.my_list_status;

  return {
    exists: listStatus !== undefined,
    progress: listStatus?.num_episodes_watched ?? 0,
    status: listStatus?.status
      ? fromMalStatus(listStatus.status, listStatus.is_rewatching ?? false)
      : null,
    score: listStatus?.score ?? 0,
    totalEpisodes: json.num_episodes || null,
  };
}

export async function writeMalEntry(
  accessToken: string,
  malMediaId: number,
  values: TrackerWrite
) {
  const mapped = MIRROR_TO_MAL[values.status];

  await malFetch(
    accessToken,
    `https://api.myanimelist.net/v2/anime/${malMediaId}/my_list_status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        num_watched_episodes: String(values.progress),
        status: mapped.status,
        ...(values.keepRewatchFlag
          ? {}
          : { is_rewatching: String(mapped.isRewatching) }),
        ...(values.score !== undefined ? { score: String(values.score) } : {}),
      }),
    }
  );
}

/** Removes the anime from the tracker's list entirely. */
export async function deleteMalEntry(accessToken: string, malMediaId: number) {
  await malFetch(
    accessToken,
    `https://api.myanimelist.net/v2/anime/${malMediaId}/my_list_status`,
    // 404 means it was already absent, which is the state the caller wanted.
    { method: "DELETE", allowNotFound: true }
  );
}

export async function deleteAniListEntry(accessToken: string, mediaId: number) {
  const data = await anilistRequest<{
    Media: { mediaListEntry: { id: number } | null } | null;
  }>(
    `query ($id: Int) { Media(id: $id, type: ANIME) { mediaListEntry { id } } }`,
    { id: mediaId },
    { accessToken }
  );

  const entryId = data.Media?.mediaListEntry?.id;
  if (!entryId) return;

  await anilistRequest(
    `mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }`,
    { id: entryId },
    { accessToken }
  );
}
