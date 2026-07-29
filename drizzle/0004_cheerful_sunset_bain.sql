PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_library_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	`sync_anilist` integer DEFAULT true NOT NULL,
	`sync_mal` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_library_entry`("id", "user_id", "anilist_media_id", "mal_media_id", "title_romaji", "title_english", "cover_image_url", "total_episodes", "progress", "anilist_status", "last_activity_at", "anilist_added_at", "sync_anilist", "sync_mal", "created_at", "updated_at") SELECT "id", "user_id", "anilist_media_id", "mal_media_id", "title_romaji", "title_english", "cover_image_url", "total_episodes", "progress", "anilist_status", "last_activity_at", "anilist_added_at", "sync_anilist", "sync_mal", "created_at", "updated_at" FROM `library_entry`;--> statement-breakpoint
DROP TABLE `library_entry`;--> statement-breakpoint
ALTER TABLE `__new_library_entry` RENAME TO `library_entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `library_entry_user_media_idx` ON `library_entry` (`user_id`,`anilist_media_id`);--> statement-breakpoint
-- The new default only applies to rows inserted from now on. Existing entries
-- were created while the default was false, so MyAnimeList writes are off for
-- the whole library and would stay off without this.
UPDATE `library_entry` SET `sync_mal` = true WHERE `mal_media_id` IS NOT NULL;
