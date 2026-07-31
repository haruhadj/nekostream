import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { libraryEntry } from "@/db/schema";
import { anilistRequest, AniListError } from "@/lib/anilist/client";
import { viewerLibrary } from "@/lib/anilist/queries";
import { auth } from "@/lib/auth";
import { MalError } from "@/lib/mal/client";
import { viewerMalList } from "@/lib/mal/queries";
import {
  buildMirrorPlan,
  fromAniListStatus,
  fromMalStatus,
  type AniListItem,
  type MalItem,
  type MirrorRow,
  type MirrorStatus,
} from "@/lib/sync/mirror";
import {
  writeAniListEntry,
  writeMalEntry,
  type TrackerWrite,
} from "@/lib/sync/tracker-entry";
import { getValidAccessToken, TokenError } from "@/lib/tokens";

type Env = { Variables: { userId: string } };

export const mirrorRoutes = new Hono<Env>();

mirrorRoutes.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in with AniList first." }, 401);
  c.set("userId", session.user.id);
  await next();
});

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

function errorResponse(error: unknown) {
  if (error instanceof TokenError) {
    return {
      body: { error: error.message, provider: error.provider },
      status: 401 as const,
    };
  }
  if (error instanceof MalError) {
    return { body: { error: error.message }, status: 502 as const };
  }
  if (error instanceof AniListError) {
    return { body: { error: error.message }, status: 502 as const };
  }
  return null;
}

/**
 * The dry run. Reports every disagreement between the two lists and what each
 * would become, without touching either account.
 */
mirrorRoutes.get("/", async (c) => {
  try {
    const plan = await loadPlan(c.get("userId"));
    return c.json(plan);
  } catch (error) {
    const mapped = errorResponse(error);
    if (mapped) return c.json(mapped.body, mapped.status);
    throw error;
  }
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
function resolve(row: MirrorRow, side: "anilist" | "mal"): TrackerWrite | null {
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

/**
 * Applies the user's per-row decisions.
 *
 * The plan is recomputed here rather than trusted from the client: the numbers
 * being written must come from the trackers, not from a form post. The client
 * only says which side wins for which title.
 */
mirrorRoutes.post("/apply", async (c) => {
  const parsed = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: "Invalid decisions.", issues: parsed.error.issues },
      400
    );
  }

  const userId = c.get("userId");
  const chosen = new Map(parsed.data.decisions.map((d) => [d.key, d.side]));

  let plan;
  let anilistToken;
  let malToken;
  try {
    [anilistToken, malToken] = await Promise.all([
      getValidAccessToken(userId, "anilist"),
      getValidAccessToken(userId, "mal"),
    ]);
    plan = await loadPlan(userId);
  } catch (error) {
    const mapped = errorResponse(error);
    if (mapped) return c.json(mapped.body, mapped.status);
    throw error;
  }

  const results: Array<{
    key: string;
    title: string;
    ok: boolean;
    wrote: ("anilist" | "mal")[];
    error?: string;
  }> = [];

  for (const row of plan.rows) {
    const side = chosen.get(row.key);
    if (!side) continue;

    const target = resolve(row, side);
    // The chosen side no longer has data — the list changed between the dry
    // run and now. Skipping is the only safe move.
    if (!target) {
      results.push({
        key: row.key,
        title: row.title,
        ok: false,
        wrote: [],
        error: "This title changed since the dry run. Re-run it.",
      });
      continue;
    }

    const wrote: ("anilist" | "mal")[] = [];
    try {
      if (side === "anilist") {
        if (row.malMediaId === null) throw new Error("No MyAnimeList id.");
        await writeMalEntry(malToken, row.malMediaId, target);
        wrote.push("mal");
      } else {
        const mediaId =
          row.anilistMediaId ??
          (row.malMediaId !== null
            ? await anilistIdForMal(row.malMediaId)
            : null);
        if (mediaId === null) throw new Error("No matching AniList entry.");

        await writeAniListEntry(anilistToken, mediaId, target);
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
              eq(libraryEntry.userId, userId),
              eq(libraryEntry.anilistMediaId, mediaId)
            )
          );
      }

      results.push({ key: row.key, title: row.title, ok: true, wrote });
    } catch (error) {
      results.push({
        key: row.key,
        title: row.title,
        ok: false,
        wrote,
        error: error instanceof Error ? error.message : "Write failed.",
      });
    }
  }

  return c.json({
    applied: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
});
