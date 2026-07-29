CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `episode` (
	`id` text PRIMARY KEY NOT NULL,
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
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`anilist_media_id` integer NOT NULL,
	`mal_media_id` integer,
	`title_romaji` text NOT NULL,
	`title_english` text,
	`cover_image_url` text,
	`total_episodes` integer,
	`progress` integer DEFAULT 0 NOT NULL,
	`sync_anilist` integer DEFAULT true NOT NULL,
	`sync_mal` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entry_user_media_idx` ON `library_entry` (`user_id`,`anilist_media_id`);--> statement-breakpoint
CREATE TABLE `rss_filter` (
	`id` text PRIMARY KEY NOT NULL,
	`library_entry_id` text NOT NULL,
	`query` text NOT NULL,
	`category` text DEFAULT '1_2' NOT NULL,
	`filter` text DEFAULT '0' NOT NULL,
	`release_group` text,
	`quality` text,
	`last_fetched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_entry_id`) REFERENCES `library_entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rss_filter_library_entry_idx` ON `rss_filter` (`library_entry_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
