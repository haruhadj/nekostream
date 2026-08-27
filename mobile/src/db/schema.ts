import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The device's own database — a port of the server's `src/db/schema.ts`.
 *
 * Two deliberate differences from the server, and nothing else:
 *
 *  1. **No `userId`, and no `user`/`session`/`account`/`verification`/
 *     `stremio_token` tables.** A device has exactly one user, so a column
 *     enforcing an invariant that cannot be violated here is ceremony. This
 *     does *not* relax the server's rule — every query there stays scoped to
 *     the caller (see ../../../context/architecture.md).
 *  2. **Ids default to a SQLite-generated value** rather than being written
 *     by the caller. See `deviceId` below.
 *
 * Column names are identical to the server's on purpose: it keeps a one-time
 * import from the server a straight copy (STANDALONE.md's Phase 1c), and it
 * keeps the `@shared/*` modules that are typed against these rows working
 * against either database.
 *
 * What the server keeps on `user` and the device does not store here:
 * `anilistSyncedAt` and the notification preference live in AsyncStorage
 * (scalars, not rows), and the AniList/MAL tokens live in SecureStore.
 */

/**
 * SQLite generates the id, so nothing on the device has to. The alternative
 * was a UUID library or `crypto.randomUUID()`, whose availability under
 * Hermes is exactly the kind of thing this project has been bitten by
 * assuming. `randomblob(16)` is 128 bits from SQLite's own RNG, and an
 * explicitly-supplied id still wins — which is what makes a straight copy of
 * the server's rows (with their better-auth-style text ids) work unchanged.
 */
const deviceId = sql`(lower(hex(randomblob(16))))`;

/**
 * An anime in the library. Metadata is cached from AniList so the library
 * renders without a round-trip on every screen focus.
 */
export const libraryEntry = sqliteTable(
  "library_entry",
  {
    id: text("id").primaryKey().default(deviceId),

    anilistMediaId: integer("anilist_media_id").notNull(),
    malMediaId: integer("mal_media_id"),

    // Cached AniList metadata
    titleRomaji: text("title_romaji").notNull(),
    titleEnglish: text("title_english"),
    coverImageUrl: text("cover_image_url"),
    totalEpisodes: integer("total_episodes"),

    progress: integer("progress").default(0).notNull(),

    /**
     * AniList list this entry came from (CURRENT, PLANNING, COMPLETED,
     * DROPPED, PAUSED, REPEATING). Null for entries added by hand — the
     * library filter treats those as unclassified rather than guessing.
     */
    anilistStatus: text("anilist_status"),

    /**
     * When this entry was last meaningfully touched — AniList's own MediaList
     * updatedAt on import, or now() when progress changes here. Distinct from
     * updatedAt, which moves for any row write (including the bulk import)
     * and so says nothing about the user's activity.
     */
    lastActivityAt: integer("last_activity_at", { mode: "timestamp" }),

    /**
     * When the entry was added to the AniList list. Distinct from createdAt,
     * which records when the import wrote the row here and is therefore
     * identical across the whole library.
     */
    anilistAddedAt: integer("anilist_added_at", { mode: "timestamp" }),

    /**
     * AniList's broadcast schedule for the next episode, refreshed
     * periodically. Null once a show stops releasing — which is also the
     * signal to stop polling Nyaa for it. `nextAiringAt` is the air time
     * itself, not the time a release is expected; see
     * `@shared/airing/schedule` for the lag.
     */
    nextAiringAt: integer("next_airing_at", { mode: "timestamp" }),
    nextAiringEpisode: integer("next_airing_episode"),
    airingSyncedAt: integer("airing_synced_at", { mode: "timestamp" }),

    // Per-anime sync toggles
    syncAnilist: integer("sync_anilist", { mode: "boolean" })
      .default(true)
      .notNull(),
    syncMal: integer("sync_mal", { mode: "boolean" }).default(true).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  // The server's equivalent is unique on (userId, anilistMediaId). With one
  // user per device, the media id alone carries the same meaning: a show
  // appears in the library once.
  (t) => [uniqueIndex("library_entry_media_idx").on(t.anilistMediaId)]
);

/**
 * The saved Nyaa search that defines an entry's episode list. The stored
 * parameters are what the RSS URL is rebuilt from on every refresh — the URL
 * itself is derived, never the source of truth.
 *
 * Note that on the device this table is the *only* copy: nothing on a server
 * mirrors it. See STANDALONE.md's risk table.
 */
export const rssFilter = sqliteTable(
  "rss_filter",
  {
    id: text("id").primaryKey().default(deviceId),
    libraryEntryId: text("library_entry_id")
      .notNull()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),

    /** Raw Nyaa `q` value, e.g. "mushoku tensei s3 1080p subsplease" */
    query: text("query").notNull(),
    /** Nyaa category — 1_2 is Anime / English-translated */
    category: text("category").default("1_2").notNull(),
    /** Nyaa filter — 0 none, 1 no remakes, 2 trusted only */
    filter: text("filter").default("0").notNull(),

    /** Recorded separately so the UI can show/edit them as chips */
    releaseGroup: text("release_group"),
    quality: text("quality"),

    lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),

    /**
     * Automatic polling state. The tick only touches Nyaa when `pollNextAt`
     * has passed, and clears it the moment `pollTargetEpisode` shows up in
     * the feed — so a show sits idle between broadcasts instead of being
     * polled on a timer. Null `pollNextAt` means dormant. The state machine
     * driving these three columns is `@shared/airing/schedule`, shared with
     * the server's poller rather than reimplemented.
     */
    pollNextAt: integer("poll_next_at", { mode: "timestamp" }),
    pollTargetEpisode: integer("poll_target_episode"),
    pollAttempts: integer("poll_attempts").default(0).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("rss_filter_library_entry_idx").on(t.libraryEntryId)]
);

/**
 * A single release parsed out of the RSS feed. Keyed on the Nyaa torrent id
 * so repeated refreshes are idempotent; multiple releases can share an
 * episode number (v2 re-encodes, batches), so episodeNumber is not unique.
 */
export const episode = sqliteTable(
  "episode",
  {
    id: text("id").primaryKey().default(deviceId),
    libraryEntryId: text("library_entry_id")
      .notNull()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),

    /** Nyaa view id from the RSS guid, e.g. 1888888 */
    nyaaId: integer("nyaa_id").notNull(),

    /** Null when the title has no parseable episode number (batches, movies) */
    episodeNumber: integer("episode_number"),

    /** Original torrent title, kept verbatim for display and re-parsing */
    rawTitle: text("raw_title").notNull(),
    releaseGroup: text("release_group"),
    quality: text("quality"),

    infoHash: text("info_hash").notNull(),
    magnetUri: text("magnet_uri").notNull(),

    sizeBytes: integer("size_bytes"),
    seeders: integer("seeders"),
    leechers: integer("leechers"),

    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("episode_entry_nyaa_idx").on(t.libraryEntryId, t.nyaaId),
    index("episode_entry_number_idx").on(t.libraryEntryId, t.episodeNumber),
  ]
);

export type LibraryEntryRow = typeof libraryEntry.$inferSelect;
export type RssFilterRow = typeof rssFilter.$inferSelect;
export type EpisodeRow = typeof episode.$inferSelect;
