import { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { episode, libraryEntry, rssFilter } from "@/db/schema";
import { auth } from "@/lib/auth";
import { refreshEpisodes } from "@/lib/library/refresh";
import { syncProgress } from "@/lib/sync/progress";
import { discoverFilters } from "@/lib/nyaa/discover";
import { NyaaFetchError } from "@/lib/nyaa/rss";

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
    .values({ id: crypto.randomUUID(), userId, ...parsed.data })
    .returning();

  return c.json({ entry, alreadyInLibrary: false }, 201);
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
    .set({ ...parsed.data, updatedAt: new Date() })
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
    .set({ progress, updatedAt: new Date() })
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
