/**
 * Reading and writing one anime's entry on a single tracker.
 *
 * lib/sync/progress.ts pushes progress to both trackers at once as a side
 * effect of watching an episode. This is the other mode: the user opening one
 * tracker's entry deliberately and overriding any field on it.
 */

import { anilistRequest } from "@/lib/anilist/client";
import { MalError } from "@/lib/mal/queries";
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

export async function writeAniListEntry(
  accessToken: string,
  mediaId: number,
  values: { progress: number; status: MirrorStatus; score: number }
) {
  await anilistRequest(
    `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus, $score: Float) {
       SaveMediaListEntry(
         mediaId: $mediaId, progress: $progress, status: $status, scoreRaw: $score
       ) { id }
     }`,
    {
      mediaId,
      progress: values.progress,
      status: MIRROR_TO_ANILIST[values.status],
      // scoreRaw is always on the 100-point scale regardless of the user's
      // display preference, so a 0-10 score has to be widened here.
      score: values.score * 10,
    },
    { accessToken }
  );
}

async function malFetch(accessToken: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new MalError(
      response.status,
      response.status === 401
        ? "MyAnimeList rejected the token. Link the account again."
        : `MyAnimeList returned ${response.status}${detail ? `: ${detail.slice(0, 80)}` : ""}`
    );
  }

  return response;
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
  values: { progress: number; status: MirrorStatus; score: number }
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
        is_rewatching: String(mapped.isRewatching),
        score: String(values.score),
      }),
    }
  );
}

/** Removes the anime from the tracker's list entirely. */
export async function deleteMalEntry(accessToken: string, malMediaId: number) {
  const response = await fetch(
    `https://api.myanimelist.net/v2/anime/${malMediaId}/my_list_status`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    }
  );

  // 404 means it was already absent, which is the state the caller wanted.
  if (!response.ok && response.status !== 404) {
    throw new MalError(response.status, `MyAnimeList returned ${response.status}`);
  }
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
