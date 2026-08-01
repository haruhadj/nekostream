import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { libraryEntry } from "@/db/schema";
import { anilistRequest } from "@/lib/anilist/client";
import { viewerLibrary } from "@/lib/anilist/queries";
import { viewerMalList } from "@/lib/mal/queries";
import {
  buildMirrorPlan,
  fromAniListStatus,
  fromMalStatus,
  type AniListItem,
  type MalItem,
  type MirrorRow,
  type Side,
} from "@/lib/sync/mirror";
import {
  writeAniListEntry,
  writeMalEntry,
  type TrackerWrite,
} from "@/lib/sync/tracker-entry";
import { getValidAccessToken } from "@/lib/tokens";
import {
  handleUpstreamErrors,
  parseBody,
  requireSession,
  type Env,
} from "@/server/shared";

export const mirrorRoutes = new Hono<Env>();

mirrorRoutes.use("*", requireSession);
mirrorRoutes.onError(handleUpstreamErrors);

/** Fetches both lists and pairs them. Reads only — writes nothing anywhere. */
async function loadPlan(userId: string) {
  const [anilistToken, malToken] = await Promise.all([
    getValidAccessToken(userId, "anilist"),
    getValidAccessToken(userId, "mal"),
  ]);

  const [anilistEntries, malEntries] = await Promise.all([
    viewerLibrary(anilistToken),
    viewerMalList(malToken),
  ]);

  const anilistItems: AniListItem[] = anilistEntries.map((entry) => ({
    anilistMediaId: entry.media.id,
    malMediaId: entry.media.idMal ?? null,
    title: entry.media.title.english ?? entry.media.title.romaji,
    totalEpisodes: entry.media.episodes ?? null,
    progress: entry.progress ?? 0,
    status: fromAniListStatus(entry.status),
    // AniList reports 0 for entries it never recorded a change on.
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt * 1000) : null,
  }));

  const malItems: MalItem[] = malEntries.map((entry) => ({
    malMediaId: entry.malMediaId,
    title: entry.title,
    progress: entry.progress,
    status: fromMalStatus(entry.status, entry.isRewatching),
    updatedAt: entry.updatedAt,
  }));

  return buildMirrorPlan(anilistItems, malItems);
}

/**
 * The dry run. Reports every disagreement between the two lists and what each
 * would become, without touching either account.
 */
mirrorRoutes.get("/", async (c) => {
  return c.json(await loadPlan(c.get("userId")));
});

const applySchema = z.object({
  decisions: z
    .array(
      z.object({
        key: z.string().min(1),
        /** Which tracker's values to copy onto the other. */
        side: z.enum(["anilist", "mal"]),
      })
    )
    .min(1)
    .max(400),
});

/**
 * Values one row should end up with on both trackers, or null if the chosen
 * side no longer has usable data.
 *
 * Score is deliberately absent: the user is reconciling progress and status,
 * not rating anything, so the losing side keeps its own rating.
 */
function resolve(row: MirrorRow, side: Side): TrackerWrite | null {
  const source = side === "anilist" ? row.anilist : row.mal;
  if (!source || source.status === null) return null;

  return { progress: source.progress, status: source.status };
}

/**
 * Resolves the AniList id for a MAL-only title. Needed because a row that
 * exists only on MAL has no AniList id to write against.
 */
async function anilistIdForMal(malMediaId: number): Promise<number | null> {
  const data = await anilistRequest<{ Media: { id: number } | null }>(
    `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { id } }`,
    { idMal: malMediaId }
  );
  return data.Media?.id ?? null;
}

type RowResult = {
  key: string;
  title: string;
  ok: boolean;
  /** Which trackers were actually written before any failure. */
  wrote: Side[];
  error?: string;
};

/**
 * Writes one row's chosen values to the losing tracker.
 *
 * Never throws: a failure on one title must not abandon the rest of the run,
 * so it is reported as that row's result instead.
 */
async function applyRow(
  row: MirrorRow,
  side: Side,
  tokens: { userId: string; anilistToken: string; malToken: string }
): Promise<RowResult> {
  const { key, title } = row;

  const target = resolve(row, side);
  // The chosen side no longer has data — the list changed between the dry run
  // and now. Skipping is the only safe move.
  if (!target) {
    return {
      key,
      title,
      ok: false,
      wrote: [],
      error: "This title changed since the dry run. Re-run it.",
    };
  }

  const wrote: Side[] = [];

  try {
    if (side === "anilist") {
      if (row.malMediaId === null) throw new Error("No MyAnimeList id.");
      await writeMalEntry(tokens.malToken, row.malMediaId, target);
      wrote.push("mal");
    } else {
      const mediaId =
        row.anilistMediaId ??
        (row.malMediaId !== null
          ? await anilistIdForMal(row.malMediaId)
          : null);
      if (mediaId === null) throw new Error("No matching AniList entry.");

      await writeAniListEntry(tokens.anilistToken, mediaId, target);
      wrote.push("anilist");

      // Keep the local copy in step so the library reflects the new value
      // without waiting for the next import.
      await db
        .update(libraryEntry)
        .set({
          progress: target.progress,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(libraryEntry.userId, tokens.userId),
            eq(libraryEntry.anilistMediaId, mediaId)
          )
        );
    }

    return { key, title, ok: true, wrote };
  } catch (error) {
    return {
      key,
      title,
      ok: false,
      wrote,
      error: error instanceof Error ? error.message : "Write failed.",
    };
  }
}

/**
 * Applies the user's per-row decisions.
 *
 * The plan is recomputed here rather than trusted from the client: the numbers
 * being written must come from the trackers, not from a form post. The client
 * only says which side wins for which title.
 */
mirrorRoutes.post("/apply", async (c) => {
  const data = await parseBody(c, applySchema, "Invalid decisions.");

  const userId = c.get("userId");
  const chosen = new Map(data.decisions.map((d) => [d.key, d.side]));

  const [anilistToken, malToken] = await Promise.all([
    getValidAccessToken(userId, "anilist"),
    getValidAccessToken(userId, "mal"),
  ]);
  const plan = await loadPlan(userId);

  const results: RowResult[] = [];

  for (const row of plan.rows) {
    const side = chosen.get(row.key);
    if (!side) continue;

    results.push(await applyRow(row, side, { userId, anilistToken, malToken }));
  }

  return c.json({
    applied: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
});
