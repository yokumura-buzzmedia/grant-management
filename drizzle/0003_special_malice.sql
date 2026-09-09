-- 日別コマ割当をコースごとに持つ形へ移す（01_要件定義.md 5.7）。
-- 既存の行はどのコースの割当か特定できないため、ここで捨てて `npm run db:curriculum` で作り直す。
DELETE FROM `pattern_day_sessions`;--> statement-breakpoint
ALTER TABLE `pattern_day_sessions` ADD `course_session_id` bigint unsigned NOT NULL;--> statement-breakpoint
-- 新しい一意制約を先に作る。pattern_code の外部キーが索引を必要とするので、
-- 古い索引を先に落とすと MySQL が拒否する
ALTER TABLE `pattern_day_sessions` ADD CONSTRAINT `uq_pattern_day_sessions_pattern_session` UNIQUE(`pattern_code`,`course_session_id`);
