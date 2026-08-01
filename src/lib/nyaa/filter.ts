/**
 * The saved Nyaa feed for one anime, described once.
 *
 * The same five fields were spelled out separately in the two filter
 * components and again as the route's request schema.
 */

import { z } from "zod";

import type { rssFilter } from "@/db/schema";

/** The stored feed, as the API hands it back. */
export type SavedFilter = Pick<
  typeof rssFilter.$inferSelect,
  "query" | "category" | "filter" | "releaseGroup" | "quality"
>;

/** The same shape as a request body, with Nyaa's defaults filled in. */
export const filterSchema = z.object({
  query: z.string().min(1),
  category: z.string().default("1_2"),
  filter: z.string().default("0"),
  releaseGroup: z.string().nullish(),
  quality: z.string().nullish(),
});
