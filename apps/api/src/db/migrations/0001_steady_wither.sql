CREATE TABLE `user_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`vocab_id` integer NOT NULL,
	`question_type` text NOT NULL,
	`is_correct` integer NOT NULL,
	`response_ms` integer NOT NULL,
	`changed_answer` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_attempts_user_vocab_created_idx` ON `user_attempts` (`user_id`,`vocab_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_vocab_state` (
	`user_id` text NOT NULL,
	`vocab_id` integer NOT NULL,
	`status` text NOT NULL,
	`strength` real NOT NULL,
	`next_review_at` integer NOT NULL,
	`last_seen_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_vocab_state_pk` ON `user_vocab_state` (`user_id`,`vocab_id`);--> statement-breakpoint
CREATE INDEX `user_vocab_state_next_review_idx` ON `user_vocab_state` (`user_id`,`next_review_at`);--> statement-breakpoint
CREATE INDEX `vocab_items_word_idx` ON `vocab_items` (`word`);