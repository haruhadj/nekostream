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
  /**
   * Last time the local library was seeded from this user's AniList lists.
   * Null means never — which is what distinguishes a first-time user from one
   * whose AniList account is genuinely empty.
   */
  anilistSyncedAt: integer("anilist_synced_at", { mode: "timestamp" }),

  /**
   * Where the new-episode email goes. Not `email` — AniList and MAL return no
   * real address, so that column holds a synthesized `id@provider.local`
   * placeholder (see fetchAniListUser/fetchMalUser in lib/auth.ts) that
   * nothing can actually deliver to. Null until the user sets one in Settings.
   */
  notificationEmail: text("notification_email"),

  /**
   * App-wide toggle for the new-episode email. Still scoped per-anime by
   * whether that anime has a saved rss_filter — see lib/airing/poller.ts,
   * which is the only place that sends this mail, and requires
   * notificationEmail to be set before it will.
   */
  notifyNewEpisodesByEmail: integer("notify_new_episodes_by_email", {
    mode: "boolean",
  })
    .default(false)
    .notNull(),

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

    /**
     * AniList list this entry came from (CURRENT, PLANNING, COMPLETED, DROPPED,
     * PAUSED, REPEATING). Null for entries added by hand in NekoStream — the
     * library filter treats those as unclassified rather than guessing.
     */
    anilistStatus: text("anilist_status"),

    /**
     * When this entry was last meaningfully touched — AniList's own MediaList
     * updatedAt on import, or now() when progress changes here. Distinct from
     * updatedAt, which moves for any row write (including the bulk import) and
     * so says nothing about the user's activity.
     */
    lastActivityAt: integer("last_activity_at", { mode: "timestamp" }),

    /**
     * When the entry was added to the AniList list. Distinct from createdAt,
     * which records when the bulk import wrote the row here and is therefore
     * identical across the whole library.
     */
    anilistAddedAt: integer("anilist_added_at", { mode: "timestamp" }),

    /**
     * AniList's broadcast schedule for the next episode, refreshed
     * periodically. Null once a show stops releasing — which is also the signal
     * to stop polling Nyaa for it. `nextAiringAt` is the air time itself, not
     * the time a release is expected; see lib/airing/schedule.ts for the lag.
     */
    nextAiringAt: integer("next_airing_at", { mode: "timestamp" }),
    nextAiringEpisode: integer("next_airing_episode"),
    airingSyncedAt: integer("airing_synced_at", { mode: "timestamp" }),

    // Per-anime sync toggles (plan.md: "Toggle progress sync per-anime")
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

    /**
     * Automatic polling state. The poller only touches Nyaa when
     * `pollNextAt` has passed, and clears it the moment `pollTargetEpisode`
     * shows up in the feed — so a show sits idle between broadcasts instead of
     * being polled on a timer. Null `pollNextAt` means dormant.
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

/**
 * The bearer token that lets Stremio reach a user's library. Stremio cannot
 * send session cookies, so the addon URL carries this secret in its path.
 * One live token per user; rotating replaces the row's token in place.
 */
export const stremioToken = sqliteTable(
  "stremio_token",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("stremio_token_user_idx").on(t.userId),
    uniqueIndex("stremio_token_token_idx").on(t.token),
  ]
);
