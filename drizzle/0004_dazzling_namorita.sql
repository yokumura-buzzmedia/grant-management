ALTER TABLE `pattern_day_sessions` DROP INDEX `uq_pattern_day_sessions_pattern_symbol`;--> statement-breakpoint
ALTER TABLE `pattern_day_sessions` DROP COLUMN `session_symbol`;--> statement-breakpoint
ALTER TABLE `pattern_day_sessions` ADD CONSTRAINT `pattern_day_sessions_course_session_id_course_sessions_id_fk` FOREIGN KEY (`course_session_id`) REFERENCES `course_sessions`(`id`) ON DELETE cascade ON UPDATE no action;
