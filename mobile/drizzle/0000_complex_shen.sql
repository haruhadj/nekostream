CREATE TABLE `episode` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`library_entry_id` text NOT NULL,
	`nyaa_id` integer NOT NULL,
	`episode_number` integer,
	`raw_title` text NOT NULL,
	`release_group` text,
	`quality` text,
	`info_hash` text NOT NULL,
	`magnet_uri` text NOT NULL,
	`size_bytes` integer,
	`seeders` integer,
	`leechers` integer,
	`published_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`library_entry_id`) REFERENCES `library_entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_entry_nyaa_idx` ON `episode` (`library_entry_id`,`nyaa_id`);--> statement-breakpoint
CREATE INDEX `episode_entry_number_idx` ON `episode` (`library_entry_id`,`episode_number`);--> statement-breakpoint
CREATE TABLE `library_entry` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`anilist_media_id` integer NOT NULL,
	`mal_media_id` integer,
	`title_romaji` text NOT NULL,
	`title_english` text,
	`cover_image_url` text,
	`total_episodes` integer,
	`progress` integer DEFAULT 0 NOT NULL,
	`anilist_status` text,
	`last_activity_at` integer,
	`anilist_added_at` integer,
	`next_airing_at` integer,
	`next_airing_episode` integer,
	`airing_synced_at` integer,
	`sync_anilist` integer DEFAULT true NOT NULL,
	`sync_mal` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entry_media_idx` ON `library_entry` (`anilist_media_id`);--> statement-breakpoint
CREATE TABLE `rss_filter` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`library_entry_id` text NOT NULL,
	`query` text NOT NULL,
	`category` text DEFAULT '1_2' NOT NULL,
	`filter` text DEFAULT '0' NOT NULL,
	`release_group` text,
	`quality` text,
	`last_fetched_at` integer,
	`poll_next_at` integer,
	`poll_target_episode` integer,
	`poll_attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_entry_id`) REFERENCES `library_entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rss_filter_library_entry_idx` ON `rss_filter` (`library_entry_id`);