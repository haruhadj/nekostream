import { anilistRequest } from "@/lib/anilist/client";
import { getValidAccessToken, TokenError, type Provider } from "@/lib/tokens";
import { deriveStatus, type TrackerStatus } from "./status";

export { deriveStatus, type TrackerStatus };

export type SyncOutcome =
  | { provider: Provider; ok: true; skipped?: false }
  | { provider: Provider; ok: false; skipped?: false; error: string }
  | { provider: Provider; ok: true; skipped: true; reason: string };

const ANILIST_STATUS: Record<TrackerStatus, string> = {
  watching: "CURRENT",
  completed: "COMPLETED",
};

async function pushToAniList(
  accessToken: string,
  mediaId: number,
  progress: number,
  status: TrackerStatus
) {
  await anilistRequest(
    `mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
       SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
         id
         progress
         status
       }
     }`,
    { mediaId, progress, status: ANILIST_STATUS[status] },
    { accessToken }
  );
}

async function pushToMal(
  accessToken: string,
  malMediaId: number,
  progress: number,
  status: TrackerStatus
) {
  const response = await fetch(
    `https://api.myanimelist.net/v2/anime/${malMediaId}/my_list_status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        num_watched_episodes: String(progress),
        status: status === "completed" ? "completed" : "watching",
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `MyAnimeList returned ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`
    );
  }
}

export type SyncTarget = {
  userId: string;
  anilistMediaId: number;
  malMediaId: number | null;
  totalEpisodes: number | null;
  syncAnilist: boolean;
  syncMal: boolean;
};

/**
 * Writes progress to both trackers at once (the Mihon/Aniyomi model). Each
 * tracker is independent: one failing never blocks the other, and the caller
 * has already saved progress locally, so a failure here is reportable rather
 * than data-losing.
 */
export async function syncProgress(
  target: SyncTarget,
  progress: number
): Promise<SyncOutcome[]> {
  const status = deriveStatus(progress, target.totalEpisodes);

  const jobs: Array<Promise<SyncOutcome>> = [];

  if (target.syncAnilist) {
    jobs.push(
      run("anilist", async () => {
        const token = await getValidAccessToken(target.userId, "anilist");
        await pushToAniList(token, target.anilistMediaId, progress, status);
      })
    );
  }

  if (target.syncMal) {
    if (target.malMediaId === null) {
      jobs.push(
        Promise.resolve({
          provider: "mal" as const,
          ok: true as const,
          skipped: true as const,
          reason: "This title has no MyAnimeList entry.",
        })
      );
    } else {
      const malMediaId = target.malMediaId;
      jobs.push(
        run("mal", async () => {
          const token = await getValidAccessToken(target.userId, "mal");
          await pushToMal(token, malMediaId, progress, status);
        })
      );
    }
  }

  return Promise.all(jobs);
}

async function run(
  provider: Provider,
  work: () => Promise<void>
): Promise<SyncOutcome> {
  try {
    await work();
    return { provider, ok: true };
  } catch (error) {
    return {
      provider,
      ok: false,
      error:
        error instanceof TokenError || error instanceof Error
          ? error.message
          : "Sync failed.",
    };
  }
}
