/**
 * The saved Nyaa feed for one anime, described once.
 *
 * The same five fields were spelled out separately in the two filter
 * components and again as the route's request schema.
 */

import { z } from "zod";

/**
 * The stored feed, as the API hands it back.
 *
 * Spelled out rather than derived from `rssFilter.$inferSelect`: this module
 * is shared with the mobile client through `@shared/*`, which has its own
 * `rss_filter` table and cannot import the server's `db/schema` at all. Both
 * schemas satisfy this structurally, and a column that drifted from it would
 * fail to typecheck wherever a row is passed as a `SavedFilter`.
 */
export type SavedFilter = {
  query: string;
  category: string;
  filter: string;
  releaseGroup: string | null;
  quality: string | null;
};

/** The same shape as a request body, with Nyaa's defaults filled in. */
export const filterSchema = z.object({
  query: z.string().min(1),
  category: z.string().default("1_2"),
  filter: z.string().default("0"),
  releaseGroup: z.string().nullish(),
  quality: z.string().nullish(),
});
