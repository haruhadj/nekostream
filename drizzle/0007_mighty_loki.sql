ALTER TABLE `user` ADD `notification_email` text;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_new_episodes_by_email` integer DEFAULT false NOT NULL;