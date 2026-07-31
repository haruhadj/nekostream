import { Hono } from "hono";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { AniListError } from "@/lib/anilist/client";
import { mediaById, searchMedia, trendingMedia } from "@/lib/anilist/queries";

type Env = { Variables: { userId: string } };

export const anilistRoutes = new Hono<Env>();

anilistRoutes.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Sign in with AniList first." }, 401);
  c.set("userId", session.user.id);
  await next();
});

const searchSchema = z.object({
  q: z.string().trim().default(""),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

/** Empty query falls back to trending so browse is never a blank screen. */
anilistRoutes.get("/search", async (c) => {
  const parsed = searchSchema.safeParse({
    q: c.req.query("q"),
    page: c.req.query("page") ?? 1,
  });

  if (!parsed.success) {
    return c.json(
      { error: "Invalid search.", issues: parsed.error.issues },
      400
    );
  }

  const { q, page } = parsed.data;

  try {
    const result = q
      ? await searchMedia(q, { page })
      : await trendingMedia({ page });
    return c.json({ query: q, ...result });
  } catch (error) {
    if (error instanceof AniListError) {
      return c.json({ error: error.message }, error.status === 429 ? 429 : 502);
    }
    throw error;
  }
});

anilistRoutes.get("/media/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: "Invalid media id." }, 400);
  }

  try {
    const media = await mediaById(id);
    if (!media) return c.json({ error: "Not found on AniList." }, 404);
    return c.json({ media });
  } catch (error) {
    if (error instanceof AniListError) {
      return c.json({ error: error.message }, error.status === 429 ? 429 : 502);
    }
    throw error;
  }
});
