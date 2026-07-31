import { getValidAccessToken, TokenError, type Provider } from "@/lib/tokens";
import {
  writeAniListEntry,
  writeMalEntry,
  type TrackerWrite,
} from "./tracker-entry.ts";
import { deriveStatus } from "./status.ts";

export type SyncOutcome =
  | { provider: Provider; ok: true; skipped?: false }
  | { provider: Provider; ok: false; skipped?: false; error: string }
  | { provider: Provider; ok: true; skipped: true; reason: string };

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
  // Progress and status only. Score is left to the tracker editor, and the
  // rewatch flag is left to whatever the tracker already holds.
  const write: TrackerWrite = {
    progress,
    status: deriveStatus(progress, target.totalEpisodes),
    keepRewatchFlag: true,
  };

  const jobs: Array<Promise<SyncOutcome>> = [];

  if (target.syncAnilist) {
    jobs.push(
      run("anilist", async () => {
        const token = await getValidAccessToken(target.userId, "anilist");
        await writeAniListEntry(token, target.anilistMediaId, write);
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
          await writeMalEntry(token, malMediaId, write);
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
