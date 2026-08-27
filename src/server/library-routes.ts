import { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { episode, libraryEntry, rssFilter, user } from "@/db/schema";
import { importAniListLibrary } from "@/lib/anilist/import";
import { getValidAccessToken } from "@/lib/tokens";
import { getScheduleEntries } from "@/lib/library/schedule";
import { refreshEpisodes } from "@/lib/library/refresh";
import { syncProgress } from "@/lib/sync/progress";
import { MIRROR_TO_ANILIST } from "@/lib/sync/mirror";
import {
  deleteAniListEntry,
  deleteMalEntry,
  readAniListEntry,
  readMalEntry,
  writeAniListEntry,
  writeMalEntry,
} from "@/lib/sync/tracker-entry";
import { discoverFilters } from "@/lib/nyaa/discover";
import { filterSchema } from "@/lib/nyaa/filter";
import {
  getOrCreateStremioToken,
  rotateStremioToken,
  stremioManifestUrl,
} from "@/server/stremio-routes";
import {
  handleUpstreamErrors,
  parseBody,
  parseParam,
  requireEntry,
  requireSession,
  type Env,
} from "@/server/shared";

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

export const libraryRoutes = new Hono<Env>();

// AniList sign-in gates the whole library surface.
libraryRoutes.use("*", requireSession);
libraryRoutes.onError(handleUpstreamErrors);

libraryRoutes.get("/", async (c) => {
  const entries = await db
    .select()
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, c.get("userId")))
    .orderBy(asc(libraryEntry.titleRomaji));

  return c.json({ entries });
});

libraryRoutes.post("/", async (c) => {
  const data = await parseBody(c, addEntrySchema, "Invalid anime.");

  const userId = c.get("userId");

  const [existing] = await db
    .select()
    .from(libraryEntry)
    .where(
      and(
        eq(libraryEntry.userId, userId),
        eq(libraryEntry.anilistMediaId, data.anilistMediaId)
      )
    )
    .limit(1);

  if (existing) return c.json({ entry: existing, alreadyInLibrary: true });

  const [entry] = await db
    .insert(libraryEntry)
    .values({
      id: crypto.randomUUID(),
      userId,
      ...data,
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
 * Every library entry with a next episode still ahead — what `/schedule`
 * renders. Declared with the other literal paths, ahead of the "/:id"
 * routes — Hono matches in order and would otherwise read "schedule" as an
 * entry id.
 */
libraryRoutes.get("/schedule", async (c) => {
  const entries = await getScheduleEntries(c.get("userId"));
  return c.json({ entries });
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

  return c.json({
    ...(await importAniListLibrary(userId)),
    throttled: false,
  });
});

libraryRoutes.patch("/:id", async (c) => {
  const entry = await requireEntry(c);

  const data = await parseBody(c, updateEntrySchema, "Invalid update.");

  const [updated] = await db
    .update(libraryEntry)
    .set({
      ...data,
      updatedAt: new Date(),
      // Watching an episode is activity; flipping a sync toggle is not, and
      // shouldn't push the entry to the top of the "Last updated" sort.
      ...(data.progress !== undefined ? { lastActivityAt: new Date() } : {}),
    })
    .where(eq(libraryEntry.id, entry.id))
    .returning();

  return c.json({ entry: updated });
});

libraryRoutes.delete("/:id", async (c) => {
  const entry = await requireEntry(c);

  await db.delete(libraryEntry).where(eq(libraryEntry.id, entry.id));
  return c.json({ removed: true });
});

/**
 * Probes Nyaa so the first-time setup screen can offer real groups/qualities.
 * Defaults the search to the entry's own title.
 */
libraryRoutes.get("/:id/discover", async (c) => {
  const entry = await requireEntry(c);

  const query = c.req.query("q")?.trim() || entry.titleRomaji;

  return c.json({ query, ...(await discoverFilters(query)) });
});

libraryRoutes.get("/:id/filter", async (c) => {
  const entry = await requireEntry(c);

  const [filter] = await db
    .select()
    .from(rssFilter)
    .where(eq(rssFilter.libraryEntryId, entry.id))
    .limit(1);

  return c.json({ filter: filter ?? null });
});

/**
 * Saving a filter replaces any previous one — an entry has exactly one feed.
 * Episodes already discovered belong to the old query, so they're cleared
 * out too; otherwise stale releases (old release group/quality/episode
 * numbers) would linger alongside whatever the new filter turns up.
 */
libraryRoutes.put("/:id/filter", async (c) => {
  const entry = await requireEntry(c);

  const data = await parseBody(c, filterSchema, "Invalid filter.");

  const filter = await db.transaction(async (tx) => {
    await tx.delete(episode).where(eq(episode.libraryEntryId, entry.id));

    const [filter] = await tx
      .insert(rssFilter)
      .values({
        id: crypto.randomUUID(),
        libraryEntryId: entry.id,
        ...data,
      })
      .onConflictDoUpdate({
        target: rssFilter.libraryEntryId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();

    return filter;
  });

  return c.json({ filter });
});

/**
 * Stops tracking this anime on Nyaa. Deleting the feed is what the poller
 * checks for — see lib/airing/poller.ts — so this alone disarms polling.
 * Episodes already found are cleared too, so re-adding a filter later
 * starts from a clean slate instead of resurrecting old releases.
 */
libraryRoutes.delete("/:id/filter", async (c) => {
  const entry = await requireEntry(c);

  await db.transaction(async (tx) => {
    await tx.delete(rssFilter).where(eq(rssFilter.libraryEntryId, entry.id));
    await tx.delete(episode).where(eq(episode.libraryEntryId, entry.id));
  });

  return c.json({ removed: true });
});

/** Manual refresh — v1 has no scheduled polling by design. */
libraryRoutes.post("/:id/refresh", async (c) => {
  const entry = await requireEntry(c);

  return c.json(await refreshEpisodes(entry.id));
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
  const entry = await requireEntry(c);

  const data = await parseBody(c, progressSchema, "Invalid progress.");

  const { progress } = data;

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
  const entry = await requireEntry(c);

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

libraryRoutes.get("/:id/tracker/:provider", async (c) => {
  const userId = c.get("userId");
  const entry = await requireEntry(c);

  const provider = parseParam(
    providerParam,
    c.req.param("provider"),
    "Unknown tracker."
  );

  if (provider === "mal" && entry.malMediaId === null) {
    return c.json({ error: "This title has no MyAnimeList entry." }, 404);
  }

  const token = await getValidAccessToken(userId, provider);
  const tracker =
    provider === "anilist"
      ? await readAniListEntry(token, entry.anilistMediaId)
      : await readMalEntry(token, entry.malMediaId!);

  return c.json({ tracker });
});

libraryRoutes.put("/:id/tracker/:provider", async (c) => {
  const userId = c.get("userId");
  const entry = await requireEntry(c);

  const provider = parseParam(
    providerParam,
    c.req.param("provider"),
    "Unknown tracker."
  );

  const data = await parseBody(c, trackerSchema, "Invalid values.");

  if (provider === "mal" && entry.malMediaId === null) {
    return c.json({ error: "This title has no MyAnimeList entry." }, 404);
  }

  const token = await getValidAccessToken(userId, provider);

  if (provider === "anilist") {
    await writeAniListEntry(token, entry.anilistMediaId, data);
  } else {
    await writeMalEntry(token, entry.malMediaId!, data);
  }

  // The local row mirrors AniList, which is what the library renders from.
  // A MAL-only edit deliberately leaves it alone rather than letting one
  // tracker silently redefine local progress.
  if (provider === "anilist") {
    await db
      .update(libraryEntry)
      .set({
        progress: data.progress,
        anilistStatus: MIRROR_TO_ANILIST[data.status],
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(libraryEntry.id, entry.id));
  }

  return c.json({ ok: true });
});

libraryRoutes.delete("/:id/tracker/:provider", async (c) => {
  const userId = c.get("userId");
  const entry = await requireEntry(c);

  const provider = parseParam(
    providerParam,
    c.req.param("provider"),
    "Unknown tracker."
  );

  const token = await getValidAccessToken(userId, provider);

  if (provider === "anilist") {
    await deleteAniListEntry(token, entry.anilistMediaId);
  } else if (entry.malMediaId !== null) {
    await deleteMalEntry(token, entry.malMediaId);
  }

  return c.json({ ok: true });
});
