import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

/**
 * Holds the per-provider OAuth tokens (AniList + MAL). The dual-write progress
 * sync reads access/refresh tokens from here — do not duplicate token storage
 * elsewhere.
 */
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

/* ------------------------------------------------------------------ *
 * NekoStream domain
 * ------------------------------------------------------------------ */

/**
 * An anime the user has added to their local library. Metadata is cached from
 * AniList so the library renders without a round-trip on every page load.
 */
export const libraryEntry = sqliteTable(
  "library_entry",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    anilistMediaId: integer("anilist_media_id").notNull(),
    malMediaId: integer("mal_media_id"),

    // Cached AniList metadata
    titleRomaji: text("title_romaji").notNull(),
    titleEnglish: text("title_english"),
    coverImageUrl: text("cover_image_url"),
    totalEpisodes: integer("total_episodes"),

    progress: integer("progress").default(0).notNull(),

    // Per-anime sync toggles (plan.md: "Toggle progress sync per-anime")
    syncAnilist: integer("sync_anilist", { mode: "boolean" })
      .default(true)
      .notNull(),
    syncMal: integer("sync_mal", { mode: "boolean" }).default(false).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("library_entry_user_media_idx").on(t.userId, t.anilistMediaId),
  ]
);

/**
 * The saved Nyaa search that defines an entry's episode list. The stored
 * parameters are what the RSS URL is rebuilt from on every refresh — the URL
 * itself is derived, never the source of truth.
 */
export const rssFilter = sqliteTable(
  "rss_filter",
  {
    id: text("id").primaryKey(),
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

    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("rss_filter_library_entry_idx").on(t.libraryEntryId),
  ]
);

/**
 * A single release parsed out of the RSS feed. Keyed on the Nyaa torrent id so
 * repeated refreshes are idempotent; multiple releases can share an episode
 * number (v2 re-encodes, batches), so episodeNumber is not unique.
 */
export const episode = sqliteTable(
  "episode",
  {
    id: text("id").primaryKey(),
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
