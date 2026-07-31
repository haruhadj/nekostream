import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { episode, libraryEntry, stremioToken } from "@/db/schema";
import { env } from "@/lib/env";
import { formatBytes } from "@/lib/format";
import { applyFilter, FILTERS } from "@/lib/library/filters";
import { DEFAULT_SORT, SORTS, sortEntries } from "@/lib/library/sort";
import { TRACKERS } from "@/lib/nyaa/rss";

type Env = { Variables: { userId: string } };

/** Our own id namespace, so Stremio routes meta/stream requests back to us. */
const ID_PREFIX = "nekostream:";

/**
 * Releases whose title has no parseable episode number (batches, movies) are
 * collected under one pseudo-episode rather than being dropped.
 */
const BATCH_EPISODE = 0;

/** The sort orders offered in Discover, labelled exactly as the web app does. */
const SORT_LABELS = SORTS.map((s) => s.label);

/** Stremio catalog ids are global, so they carry the addon's namespace. */
function catalogId(filterKey: string) {
  return `nekostream-${filterKey}`;
}

function generateStremioToken() {
  return randomBytes(24).toString("base64url");
}

/** Returns the user's token, minting one on first use. */
export async function getOrCreateStremioToken(userId: string) {
  const [existing] = await db
    .select()
    .from(stremioToken)
    .where(eq(stremioToken.userId, userId))
    .limit(1);
  if (existing) return existing.token;

  const token = generateStremioToken();
  await db
    .insert(stremioToken)
    .values({ id: crypto.randomUUID(), userId, token, createdAt: new Date() });
  return token;
}

/** Invalidates the old token — any Stremio install using it stops working. */
export async function rotateStremioToken(userId: string) {
  const token = generateStremioToken();
  const [updated] = await db
    .update(stremioToken)
    .set({ token, createdAt: new Date() })
    .where(eq(stremioToken.userId, userId))
    .returning();
  if (updated) return updated.token;

  await db
    .insert(stremioToken)
    .values({ id: crypto.randomUUID(), userId, token, createdAt: new Date() });
  return token;
}

/**
 * The addon URL to hand to Stremio.
 *
 * Prefers PUBLIC_URL: the origin the browser happens to be on is often the LAN
 * address (OAuth redirects land there), and Stremio Web will not load an
 * http:// addon. Falls back to the requesting origin when unset.
 */
export function stremioManifestUrl(token: string, requestUrl: string) {
  const origin = env.PUBLIC_URL ?? new URL(requestUrl).origin;
  return `${origin.replace(/\/$/, "")}/api/stremio/${token}/manifest.json`;
}

export const stremioRoutes = new Hono<Env>();

// Stremio Web fetches the addon from a different origin, so every response —
// including the preflight — needs open CORS or the addon simply never loads.
stremioRoutes.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Headers", "*");
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

// The path token stands in for a session cookie, which Stremio can't send.
// A bad token is a 404, not a 401: there's nothing to sign in to here.
stremioRoutes.use("/:token/*", async (c, next) => {
  const [row] = await db
    .select({ userId: stremioToken.userId })
    .from(stremioToken)
    .where(eq(stremioToken.token, c.req.param("token")))
    .limit(1);
  if (!row) return c.json({ error: "Unknown addon token." }, 404);
  c.set("userId", row.userId);
  await next();
});

stremioRoutes.get("/:token/manifest.json", (c) =>
  c.json({
    id: "com.nekostream.addon",
    version: "1.0.0",
    name: "NekoStream",
    description: "Your NekoStream library, streamed from Nyaa releases.",
    resources: ["catalog", "meta", "stream"],
    types: ["series"],
    idPrefixes: [ID_PREFIX],
    // One catalog per library tab, so Stremio's Discover mirrors the web app
    // instead of collapsing everything into a single undifferentiated row.
    catalogs: FILTERS.map((filter) => ({
      type: "series",
      id: catalogId(filter.key),
      name: `NekoStream ${filter.label}`,
      // Stremio has no sort control of its own; "genre" is the protocol's
      // generic option dropdown, so the web app's sort orders ride on it.
      genres: SORT_LABELS,
      extra: [
        { name: "genre", options: SORT_LABELS, isRequired: false },
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false },
      ],
    })),
    behaviorHints: { configurable: false },
  })
);

function toMetaPreview(entry: typeof libraryEntry.$inferSelect) {
  return {
    id: ID_PREFIX + entry.id,
    type: "series" as const,
    name: entry.titleEnglish ?? entry.titleRomaji,
    poster: entry.coverImageUrl ?? undefined,
    posterShape: "poster" as const,
  };
}

type CatalogExtra = {
  search: string | null;
  genre: string | null;
  skip: string | null;
};

/** Stremio's own page size — it advances skip in steps of 100. */
const PAGE_SIZE = 100;

/** Anything unparseable means "first page" rather than an error. */
function parseSkip(raw: string | null) {
  const skip = Number(raw);
  return Number.isInteger(skip) && skip > 0 ? skip : 0;
}

async function catalog(
  userId: string,
  catalogKey: string,
  { search, genre, skip }: CatalogExtra
) {
  const filter = FILTERS.find((f) => catalogId(f.key) === catalogKey);
  if (!filter) return null;

  const entries = await db
    .select()
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, userId));

  const needle = search?.trim().toLowerCase();
  const matched = needle
    ? entries.filter((e) =>
        `${e.titleRomaji} ${e.titleEnglish ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
    : entries;

  const sort = SORTS.find((s) => s.label === genre)?.key ?? DEFAULT_SORT;

  // Filter and sort span the whole library before slicing, so page 2 is
  // genuinely the next 100 in that order rather than a re-sorted chunk.
  const ordered = sortEntries(applyFilter(matched, filter), sort);
  const offset = parseSkip(skip);

  return ordered.slice(offset, offset + PAGE_SIZE).map(toMetaPreview);
}

stremioRoutes.get("/:token/catalog/series/:catalog", async (c) => {
  const key = c.req.param("catalog").replace(/\.json$/, "");
  const metas = await catalog(c.get("userId"), key, {
    search: null,
    genre: null,
    skip: null,
  });
  return metas ? c.json({ metas }) : c.json({ error: "Unknown catalog." }, 404);
});

// Stremio appends extras as a path segment: .../<catalog>/genre=Last%20updated&skip=100.json
stremioRoutes.get("/:token/catalog/series/:catalog/:extra", async (c) => {
  const extra = new URLSearchParams(
    decodeURIComponent(c.req.param("extra")).replace(/\.json$/, "")
  );
  const metas = await catalog(c.get("userId"), c.req.param("catalog"), {
    search: extra.get("search"),
    genre: extra.get("genre"),
    skip: extra.get("skip"),
  });
  return metas ? c.json({ metas }) : c.json({ error: "Unknown catalog." }, 404);
});

/** "nekostream:<entryId>" or "nekostream:<entryId>:<season>:<episode>" */
function parseId(raw: string) {
  const id = decodeURIComponent(raw).replace(/\.json$/, "");
  if (!id.startsWith(ID_PREFIX)) return null;

  const parts = id.slice(ID_PREFIX.length).split(":");
  const entryId = parts[0];
  if (!entryId) return null;

  const episodeNumber = parts.length >= 3 ? Number(parts[2]) : null;
  if (episodeNumber !== null && !Number.isInteger(episodeNumber)) return null;

  return { entryId, episodeNumber };
}

/** Scoped by userId so one token can never reach another user's library. */
async function findEntry(userId: string, entryId: string) {
  const [entry] = await db
    .select()
    .from(libraryEntry)
    .where(and(eq(libraryEntry.id, entryId), eq(libraryEntry.userId, userId)))
    .limit(1);
  return entry ?? null;
}

stremioRoutes.get("/:token/meta/series/:id", async (c) => {
  const parsed = parseId(c.req.param("id"));
  if (!parsed) return c.json({ error: "Bad id." }, 404);

  const entry = await findEntry(c.get("userId"), parsed.entryId);
  if (!entry) return c.json({ error: "Not in library." }, 404);

  const rows = await db
    .select()
    .from(episode)
    .where(eq(episode.libraryEntryId, entry.id))
    .orderBy(asc(episode.episodeNumber));

  // Many releases can share an episode number (v2s, different groups); the
  // meta needs one video per number, dated by the newest release for it.
  const released = new Map<number, Date | null>();
  for (const row of rows) {
    const number = row.episodeNumber ?? BATCH_EPISODE;
    const current = released.get(number) ?? null;
    if (
      !released.has(number) ||
      (row.publishedAt && (!current || row.publishedAt > current))
    ) {
      released.set(number, row.publishedAt);
    }
  }

  const videos = [...released.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, date]) => ({
      id: `${ID_PREFIX}${entry.id}:1:${number}`,
      title:
        number === BATCH_EPISODE ? "Batches & unnumbered" : `Episode ${number}`,
      season: 1,
      episode: number,
      released: (date ?? entry.createdAt).toISOString(),
    }));

  return c.json({
    meta: {
      ...toMetaPreview(entry),
      videos,
      background: entry.coverImageUrl ?? undefined,
    },
  });
});

stremioRoutes.get("/:token/stream/series/:id", async (c) => {
  const parsed = parseId(c.req.param("id"));
  if (!parsed || parsed.episodeNumber === null) return c.json({ streams: [] });

  const entry = await findEntry(c.get("userId"), parsed.entryId);
  if (!entry) return c.json({ streams: [] });

  const rows = await db
    .select()
    .from(episode)
    .where(eq(episode.libraryEntryId, entry.id))
    .orderBy(desc(episode.seeders));

  const wanted =
    parsed.episodeNumber === BATCH_EPISODE
      ? rows.filter(
          (r) => r.episodeNumber === null || r.episodeNumber === BATCH_EPISODE
        )
      : rows.filter((r) => r.episodeNumber === parsed.episodeNumber);

  const streams = wanted.map((row) => {
    const infoHash = row.infoHash.toLowerCase();
    const size = formatBytes(row.sizeBytes);
    return {
      name: `NekoStream${row.quality ? ` ${row.quality}` : ""}`,
      title: [
        row.rawTitle,
        [`👤 ${row.seeders ?? 0}`, size && `💾 ${size}`]
          .filter(Boolean)
          .join(" · "),
      ].join("\n"),
      // infoHash + sources (not a magnet url) is what hands the torrent to
      // Stremio's own streaming engine instead of an external player.
      infoHash,
      sources: [...TRACKERS.map((t) => `tracker:${t}`), `dht:${infoHash}`],
      behaviorHints: {
        bingeGroup: `nekostream-${entry.id}-${row.releaseGroup ?? "?"}-${row.quality ?? "?"}`,
      },
    };
  });

  return c.json({ streams });
});
