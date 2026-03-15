CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vocab_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`phonetic` text,
	`pos` text,
	`meaning_zh` text NOT NULL,
	`roots` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_items_word_unique` ON `vocab_items` (`word`);