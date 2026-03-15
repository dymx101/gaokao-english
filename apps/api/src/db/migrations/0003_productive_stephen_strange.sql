CREATE TABLE `user_mistakes` (
	`user_id` text NOT NULL,
	`vocab_id` integer NOT NULL,
	`mistake_count` integer NOT NULL,
	`mistake_level` text NOT NULL,
	`last_mistake_at` integer NOT NULL,
	`confusion_with` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_mistakes_user_vocab_uniq` ON `user_mistakes` (`user_id`,`vocab_id`);--> statement-breakpoint
CREATE INDEX `user_mistakes_level_idx` ON `user_mistakes` (`user_id`,`mistake_level`);--> statement-breakpoint
CREATE INDEX `user_mistakes_last_idx` ON `user_mistakes` (`user_id`,`last_mistake_at`);