ALTER TABLE `library_entry` ADD `next_airing_at` integer;--> statement-breakpoint
ALTER TABLE `library_entry` ADD `next_airing_episode` integer;--> statement-breakpoint
ALTER TABLE `library_entry` ADD `airing_synced_at` integer;--> statement-breakpoint
ALTER TABLE `rss_filter` ADD `poll_next_at` integer;--> statement-breakpoint
ALTER TABLE `rss_filter` ADD `poll_target_episode` integer;--> statement-breakpoint
ALTER TABLE `rss_filter` ADD `poll_attempts` integer DEFAULT 0 NOT NULL;