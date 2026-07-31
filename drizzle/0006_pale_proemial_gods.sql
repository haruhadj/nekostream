CREATE TABLE `stremio_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stremio_token_user_idx` ON `stremio_token` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stremio_token_token_idx` ON `stremio_token` (`token`);