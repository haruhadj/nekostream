/**
 * Reading and writing one anime's entry on a single tracker, deliberately —
 * the device port of `GET/PUT /api/library/:id/tracker/:provider`.
 *
 * This is the other write mode, and it is not the same as ticking progress.
 * `sync/progress.ts` pushes one number to both trackers as a side effect of
 * watching an episode; this opens what a tracker actually holds and lets the
 * user override any field of it — progress, status, score.
 *
 * The reads and writes themselves come from `@shared/sync/tracker-entry`, so
 * the GraphQL and MAL calls have one definition across the server and here.
 */

import { MIRROR_TO_ANILIST } from "@shared/sync/mirror";
import type { MirrorStatus } from "@shared/sync/mirror";
import type { Provider } from "@shared/providers";
import {
  readAniListEntry,
  readMalEntry,
  writeAniListEntry,
  writeMalEntry,
  type TrackerEntry,
} from "@shared/sync/tracker-entry";

import { getAniListToken } from "@/auth/anilist";
import { getValidMalToken } from "@/auth/mal";
import { setTrackerFields, type LibraryEntryRow } from "@/db/library";

export type { TrackerEntry };

export type TrackerForm = {
  progress: number;
  status: MirrorStatus;
  score: number;
};

async function tokenFor(provider: Provider): Promise<string> {
  const token =
    provider === "anilist" ? await getAniListToken() : await getValidMalToken();

  if (!token) {
    throw new Error(
      provider === "anilist"
        ? "AniList is not connected."
        : "MyAnimeList is not linked."
    );
  }

  return token;
}

/** What the tracker holds right now — not the local copy. */
export async function readTrackerEntry(
  entry: LibraryEntryRow,
  provider: Provider
): Promise<TrackerEntry> {
  if (provider === "mal") {
    if (entry.malMediaId === null) {
      throw new Error("This title has no MyAnimeList entry.");
    }
    return readMalEntry(await tokenFor("mal"), entry.malMediaId);
  }

  return readAniListEntry(await tokenFor("anilist"), entry.anilistMediaId);
}

/**
 * Writes the values to one tracker, and mirrors an AniList write into the
 * local row.
 *
 * A MAL-only edit deliberately leaves the local row alone — the library
 * renders from AniList, and letting one tracker silently redefine local
 * progress is exactly the confusion this rule exists to prevent. Carried over
 * from the server route verbatim.
 */
export async function writeTrackerEntry(
  entry: LibraryEntryRow,
  provider: Provider,
  form: TrackerForm
): Promise<void> {
  if (provider === "mal") {
    if (entry.malMediaId === null) {
      throw new Error("This title has no MyAnimeList entry.");
    }
    await writeMalEntry(await tokenFor("mal"), entry.malMediaId, form);
    return;
  }

  await writeAniListEntry(await tokenFor("anilist"), entry.anilistMediaId, form);

  await setTrackerFields(entry.id, {
    progress: form.progress,
    anilistStatus: MIRROR_TO_ANILIST[form.status],
  });
}
