/**
 * Ticking progress, on the device.
 *
 * This is `lib/sync/progress.ts` with its one db-bound dependency — the token
 * read — swapped for the device's own. The rule it exists to enforce is
 * unchanged, and is the reason this was ported rather than rewritten:
 *
 *   **write locally first, then push to each tracker independently and in
 *   parallel. One tracker failing never blocks the other, and never discards
 *   the local write that already happened.**
 *
 * The tracker writes themselves are not copied at all — `writeAniListEntry`
 * and `writeMalEntry` come straight from `@shared/sync/tracker-entry`, so the
 * GraphQL mutation and the MAL PATCH have exactly one definition between the
 * server and this app.
 */

import { deriveStatus } from "@shared/sync/status";
import {
  writeAniListEntry,
  writeMalEntry,
  type TrackerWrite,
} from "@shared/sync/tracker-entry";
import type { Provider } from "@shared/providers";

import { getAniListToken } from "@/auth/anilist";
import { getValidMalToken } from "@/auth/mal";
import { setProgress, type LibraryEntryRow } from "@/db/library";

export type SyncOutcome =
  | { provider: Provider; ok: true; skipped?: false }
  | { provider: Provider; ok: false; skipped?: false; error: string }
  | { provider: Provider; ok: true; skipped: true; reason: string };

export type ProgressResult = {
  /** The row as it now stands locally — already saved, whatever the trackers did. */
  entry: LibraryEntryRow | null;
  outcomes: SyncOutcome[];
};

export async function tickProgress(
  entry: LibraryEntryRow,
  progress: number
): Promise<ProgressResult> {
  // Local first. Everything below can fail without costing the user the tick.
  const saved = await setProgress(entry.id, progress);

  // Progress and status only. Score belongs to the tracker editor, and the
  // rewatch flag to whatever the tracker already holds.
  const write: TrackerWrite = {
    progress,
    status: deriveStatus(progress, entry.totalEpisodes),
    keepRewatchFlag: true,
  };

  const jobs: Promise<SyncOutcome>[] = [];

  if (entry.syncAnilist) {
    jobs.push(
      run("anilist", async () => {
        const token = await getAniListToken();
        if (!token) throw new Error("AniList is not connected.");
        await writeAniListEntry(token, entry.anilistMediaId, write);
      })
    );
  }

  if (entry.syncMal) {
    if (entry.malMediaId === null) {
      jobs.push(
        Promise.resolve({
          provider: "mal" as const,
          ok: true as const,
          skipped: true as const,
          reason: "This title has no MyAnimeList entry.",
        })
      );
    } else {
      const malMediaId = entry.malMediaId;
      jobs.push(
        run("mal", async () => {
          const token = await getValidMalToken();
          if (!token) throw new Error("MyAnimeList is not linked.");
          await writeMalEntry(token, malMediaId, write);
        })
      );
    }
  }

  return { entry: saved, outcomes: await Promise.all(jobs) };
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
      error: error instanceof Error ? error.message : "Sync failed.",
    };
  }
}
