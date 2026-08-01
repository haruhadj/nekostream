import { Hono } from "hono";
import { z } from "zod";

import { mediaById, searchMedia, trendingMedia } from "@/lib/anilist/queries";
import {
  handleUpstreamErrors,
  requireSession,
  type Env,
} from "@/server/shared";

export const anilistRoutes = new Hono<Env>();

anilistRoutes.use("*", requireSession);
anilistRoutes.onError(handleUpstreamErrors);

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

  const result = q
    ? await searchMedia(q, { page })
    : await trendingMedia({ page });
  return c.json({ query: q, ...result });
});

anilistRoutes.get("/media/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) {
    return c.json({ error: "Invalid media id." }, 400);
  }

  const media = await mediaById(id);
  if (!media) return c.json({ error: "Not found on AniList." }, 404);

  return c.json({ media });
});
