CREATE TABLE `freee_sign_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`singleton` char(1) NOT NULL DEFAULT 'x',
	`access_token` varchar(2048) NOT NULL,
	`access_token_expires_at` datetime NOT NULL,
	`refresh_token` varchar(2048) NOT NULL,
	`authorized_by` bigint unsigned,
	`authorized_by_name` varchar(100) NOT NULL,
	`authorized_at` datetime NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `freee_sign_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_freee_sign_tokens_singleton` UNIQUE(`singleton`),
	CONSTRAINT `chk_freee_sign_tokens_singleton` CHECK(`singleton` = 'x')
);
--> statement-breakpoint
ALTER TABLE `freee_sign_tokens` ADD CONSTRAINT `freee_sign_tokens_authorized_by_users_id_fk` FOREIGN KEY (`authorized_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;