ALTER TABLE `trainees` ADD `name_kana` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `trainees` ADD `job_type` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `trainees` ADD `job_description` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `trainees` ADD `gender` varchar(16) NOT NULL;--> statement-breakpoint
ALTER TABLE `trainees` ADD CONSTRAINT `chk_trainees_gender` CHECK (`gender` in ('male', 'female', 'other'));