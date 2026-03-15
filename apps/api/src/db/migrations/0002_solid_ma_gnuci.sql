DROP INDEX `user_vocab_state_pk`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_vocab_state_user_vocab_uniq` ON `user_vocab_state` (`user_id`,`vocab_id`);