import { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { episode, libraryEntry, rssFilter, user } from "@/db/schema";
import { AniListError } from "@/lib/anilist/client";
import { importAniListLibrary } from "@/lib/anilist/import";
import { auth } from "@/lib/auth";
import { getValidAccessToken, TokenError } from "@/lib/tokens";
import { refreshEpisodes } from "@/lib/library/refresh";
import { syncProgress } from "@/lib/sync/progress";
import { MIRROR_TO_ANILIST } from "@/lib/sync/mirror";
import { MalError } from "@/lib/mal/queries";
import {
  deleteAniListEntry,
  deleteMalEntry,
  readAniListEntry,
  readMalEntry,
  writeAniListEntry,
  writeMalEntry,
} from "@/lib/sync/tracker-entry";
import { discoverFilters } from "@/lib/nyaa/discover";
import { NyaaFetchError } from "@/lib/nyaa/rss";
import {
  getOrCreateStremioToken,
  rotateStremioToken,
  stremioManifestUrl,
} from "@/server/stremio-routes";

type Env = { Variables: { userId: string } };

const addEntrySchema = z.object({
  anilistMediaId: z.number().int().positive(),
  titleRomaji: z.string().min(1),
  titleEnglish: z.string().nullish(),
  coverImageUrl: z.url().nullish(),
  totalEpisodes: z.number().int().positive().nullish(),
  malMediaId: z.number().int().positive().nullish(),
});

const updateEntrySchema = z
  .object({
    progress: z.number().int().min(0),
    syncAnilist: z.boolean(),
    syncMal: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field.");

const filterSchema = z.object({
  query: z.string().min(1),
  category: z.string().default("1_2"),
  filter: z.string().default("0"),
  releaseGroup: z.string().nullish(),
  quality: z.string().nullish(),
});

export const libraryRoutes = new Hono<Env>();

// AniList sign-in gates the whole library surface.
libraryRoutes.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in with AniList first." }, 401);
  c.set("userId", session.user.id);
  await next();
});

/** Scopes every lookup to the caller so ids from another account 404. */
async function findEntry(userId: string, id: string) {
  const [entry] = await db
    .select()
    .from(libraryEntry)
    .where(and(eq(libraryEntry.id, id), eq(libraryEntry.userId, userId)))
    .limit(1);
  return entry ?? null;
}

libraryRoutes.get("/", async (c) => {
  const entries = await db
    .select()
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, c.get("userId")))
    .orderBy(asc(libraryEntry.titleRomaji));

  return c.json({ entries });
});

libraryRoutes.post("/", async (c) => {
  const parsed = addEntrySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid anime.", issues: parsed.error.issues }, 400);
  }

  const userId = c.get("userId");

  const [existing] = await db
    .select()
    .from(libraryEntry)
    .where(
      and(
        eq(libraryEntry.userId, userId),
        eq(libraryEntry.anilistMediaId, parsed.data.anilistMediaId)
      )
    )
    .limit(1);

  if (existing) return c.json({ entry: existing, alreadyInLibrary: true });

  const [entry] = await db
    .insert(libraryEntry)
    .values({
      id: crypto.randomUUID(),
      userId,
      ...parsed.data,
      // Manually-added titles start untracked — syncing would otherwise push
      // a brand-new entry onto the user's real AniList/MAL lists the moment
      // they touch progress. AniList imports set these true on their own path.
      syncAnilist: false,
      syncMal: false,
    })
    .returning();

  return c.json({ entry, alreadyInLibrary: false }, 201);
});

/** Skip a re-import when one ran recently, unless the caller forces it. */
const SYNC_THROTTLE_MS = 5 * 60_000;

/**
 * The Stremio addon's secret, and the URL to install it from.
 *
 * Declared with the other literal paths, ahead of the "/:id" routes — Hono
 * matches in order and would otherwise read these as an entry id.
 */
libraryRoutes.get("/stremio-token", async (c) => {
  const token = await getOrCreateStremioToken(c.get("userId"));
  return c.json({ token, url: stremioManifestUrl(token, c.req.url) });
});

libraryRoutes.post("/stremio-token/rotate", async (c) => {
  const token = await rotateStremioToken(c.get("userId"));
  return c.json({ token, url: stremioManifestUrl(token, c.req.url) });
});

/**
 * Mirrors the user's AniList lists into the local library. The library page
 * fires this on every visit, so the throttle is what keeps ordinary navigation
 * from costing an AniList round-trip each time.
 *
 * Declared ahead of the "/:id" routes — Hono matches in order, and "/sync"
 * would otherwise be read as an entry id.
 */
libraryRoutes.post("/sync", async (c) => {
  const userId = c.get("userId");
  const force = c.req.query("force") === "1";

  const [row] = await db
    .select({ anilistSyncedAt: user.anilistSyncedAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const lastSync = row?.anilistSyncedAt?.getTime() ?? null;

  if (!force && lastSync !== null && Date.now() - lastSync < SYNC_THROTTLE_MS) {
    return c.json({ added: 0, skipped: 0, total: 0, throttled: true });
  }

  try {
    return c.json({ ...(await importAniListLibrary(userId)), throttled: false });
  } catch (error) {
    if (error instanceof TokenError) {
      return c.json({ error: error.message }, 401);
    }
    if (error instanceof AniListError) {
      return c.json({ error: error.message }, 502);
    }
    throw error;
  }
});

libraryRoutes.patch("/:id", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const parsed = updateEntrySchema.safeParse(
    await c.req.json().catch(() => null)
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid update.", issues: parsed.error.issues }, 400);
  }

  const [updated] = await db
    .update(libraryEntry)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
      // Watching an episode is activity; flipping a sync toggle is not, and
      // shouldn't push the entry to the top of the "Last updated" sort.
      ...(parsed.data.progress !== undefined
        ? { lastActivityAt: new Date() }
        : {}),
    })
    .where(eq(libraryEntry.id, entry.id))
    .returning();

  return c.json({ entry: updated });
});

libraryRoutes.delete("/:id", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  await db.delete(libraryEntry).where(eq(libraryEntry.id, entry.id));
  return c.json({ removed: true });
});

/**
 * Probes Nyaa so the first-time setup screen can offer real groups/qualities.
 * Defaults the search to the entry's own title.
 */
libraryRoutes.get("/:id/discover", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const query = c.req.query("q")?.trim() || entry.titleRomaji;

  try {
    return c.json({ query, ...(await discoverFilters(query)) });
  } catch (error) {
    if (error instanceof NyaaFetchError) {
      return c.json({ error: error.message }, 502);
    }
    throw error;
  }
});

libraryRoutes.get("/:id/filter", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const [filter] = await db
    .select()
    .from(rssFilter)
    .where(eq(rssFilter.libraryEntryId, entry.id))
    .limit(1);

  return c.json({ filter: filter ?? null });
});

/** Saving a filter replaces any previous one — an entry has exactly one feed. */
libraryRoutes.put("/:id/filter", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const parsed = filterSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid filter.", issues: parsed.error.issues }, 400);
  }

  const [filter] = await db
    .insert(rssFilter)
    .values({
      id: crypto.randomUUID(),
      libraryEntryId: entry.id,
      ...parsed.data,
    })
    .onConflictDoUpdate({
      target: rssFilter.libraryEntryId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();

  return c.json({ filter });
});

/** Manual refresh — v1 has no scheduled polling by design. */
libraryRoutes.post("/:id/refresh", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  try {
    return c.json(await refreshEpisodes(entry.id));
  } catch (error) {
    if (error instanceof NyaaFetchError) {
      return c.json({ error: error.message }, 502);
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Refresh failed." },
      400
    );
  }
});

const progressSchema = z.object({
  progress: z.number().int().min(0),
});

/**
 * Saves progress locally first, then pushes to the enabled trackers. The local
 * write is never rolled back on a tracker failure — the user watched the
 * episode either way — so failures come back as reportable per-provider results.
 */
libraryRoutes.put("/:id/progress", async (c) => {
  const userId = c.get("userId");
  const entry = await findEntry(userId, c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const parsed = progressSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid progress.", issues: parsed.error.issues }, 400);
  }

  const { progress } = parsed.data;

  const [updated] = await db
    .update(libraryEntry)
    // lastActivityAt too: this is the main way progress changes, so without it
    // the "Last updated" sort would never see anything the stepper did.
    .set({ progress, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(libraryEntry.id, entry.id))
    .returning();

  const sync = await syncProgress(
    {
      userId,
      anilistMediaId: entry.anilistMediaId,
      malMediaId: entry.malMediaId,
      totalEpisodes: entry.totalEpisodes,
      syncAnilist: entry.syncAnilist,
      syncMal: entry.syncMal,
    },
    progress
  );

  return c.json({ entry: updated, sync });
});

libraryRoutes.get("/:id/episodes", async (c) => {
  const entry = await findEntry(c.get("userId"), c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const episodes = await db
    .select()
    .from(episode)
    .where(eq(episode.libraryEntryId, entry.id))
    .orderBy(desc(episode.episodeNumber), desc(episode.publishedAt));

  return c.json({ episodes });
});

/* ------------------------------------------------------------------ *
 * Per-tracker list editor
 *
 * Reads and writes one tracker's entry for this anime directly, so the user
 * can override what a tracker holds instead of only pushing progress to it.
 * ------------------------------------------------------------------ */

const trackerSchema = z.object({
  progress: z.number().int().min(0).max(10_000),
  status: z.enum([
    "watching",
    "planning",
    "completed",
    "dropped",
    "paused",
    "repeating",
  ]),
  score: z.number().int().min(0).max(10),
});

const providerParam = z.enum(["anilist", "mal"]);

/** Turns tracker failures into a status the client can act on. */
function trackerError(error: unknown) {
  if (error instanceof TokenError) return { message: error.message, status: 401 as const };
  if (error instanceof MalError) return { message: error.message, status: 502 as const };
  if (error instanceof AniListError) return { message: error.message, status: 502 as const };
  return null;
}

libraryRoutes.get("/:id/tracker/:provider", async (c) => {
  const userId = c.get("userId");
  const entry = await findEntry(userId, c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const provider = providerParam.safeParse(c.req.param("provider"));
  if (!provider.success) return c.json({ error: "Unknown tracker." }, 404);

  if (provider.data === "mal" && entry.malMediaId === null) {
    return c.json({ error: "This title has no MyAnimeList entry." }, 404);
  }

  try {
    const token = await getValidAccessToken(userId, provider.data);
    const tracker =
      provider.data === "anilist"
        ? await readAniListEntry(token, entry.anilistMediaId)
        : await readMalEntry(token, entry.malMediaId!);

    return c.json({ tracker });
  } catch (error) {
    const mapped = trackerError(error);
    if (mapped) return c.json({ error: mapped.message }, mapped.status);
    throw error;
  }
});

libraryRoutes.put("/:id/tracker/:provider", async (c) => {
  const userId = c.get("userId");
  const entry = await findEntry(userId, c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const provider = providerParam.safeParse(c.req.param("provider"));
  if (!provider.success) return c.json({ error: "Unknown tracker." }, 404);

  const parsed = trackerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid values.", issues: parsed.error.issues }, 400);
  }

  if (provider.data === "mal" && entry.malMediaId === null) {
    return c.json({ error: "This title has no MyAnimeList entry." }, 404);
  }

  try {
    const token = await getValidAccessToken(userId, provider.data);

    if (provider.data === "anilist") {
      await writeAniListEntry(token, entry.anilistMediaId, parsed.data);
    } else {
      await writeMalEntry(token, entry.malMediaId!, parsed.data);
    }

    // The local row mirrors AniList, which is what the library renders from.
    // A MAL-only edit deliberately leaves it alone rather than letting one
    // tracker silently redefine local progress.
    if (provider.data === "anilist") {
      await db
        .update(libraryEntry)
        .set({
          progress: parsed.data.progress,
          anilistStatus: MIRROR_TO_ANILIST[parsed.data.status],
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(libraryEntry.id, entry.id));
    }

    return c.json({ ok: true });
  } catch (error) {
    const mapped = trackerError(error);
    if (mapped) return c.json({ error: mapped.message }, mapped.status);
    throw error;
  }
});

libraryRoutes.delete("/:id/tracker/:provider", async (c) => {
  const userId = c.get("userId");
  const entry = await findEntry(userId, c.req.param("id"));
  if (!entry) return c.json({ error: "Not in your library." }, 404);

  const provider = providerParam.safeParse(c.req.param("provider"));
  if (!provider.success) return c.json({ error: "Unknown tracker." }, 404);

  try {
    const token = await getValidAccessToken(userId, provider.data);

    if (provider.data === "anilist") {
      await deleteAniListEntry(token, entry.anilistMediaId);
    } else if (entry.malMediaId !== null) {
      await deleteMalEntry(token, entry.malMediaId);
    }

    return c.json({ ok: true });
  } catch (error) {
    const mapped = trackerError(error);
    if (mapped) return c.json({ error: mapped.message }, mapped.status);
    throw error;
  }
});
