CREATE TABLE `agencies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_agencies_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`corporate_number` char(13),
	`representative_name` varchar(100),
	`industry` varchar(100),
	`company_type` varchar(32),
	`employee_count` int unsigned,
	`capital` bigint,
	`postal_code` char(7),
	`address` varchar(255),
	`building_name` varchar(255),
	`phone` varchar(20),
	`contact_name` varchar(100),
	`contact_email` varchar(255),
	`referral_agency_id` bigint unsigned,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_companies_corporate_number` UNIQUE(`corporate_number`),
	CONSTRAINT `chk_companies_company_type` CHECK(`company_type` in ('corporation', 'llc', 'lp', 'general_partnership', 'sole_proprietor', 'other')),
	CONSTRAINT `chk_companies_employee_count` CHECK(`employee_count` >= 0),
	CONSTRAINT `chk_companies_capital` CHECK(`capital` >= 0)
);
--> statement-breakpoint
CREATE TABLE `employment_contracts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`trainee_id` bigint unsigned NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`content_type` varchar(100) NOT NULL,
	`file_size` bigint NOT NULL,
	`status` varchar(32) NOT NULL,
	`submitted_at` datetime NOT NULL,
	`approved_at` datetime,
	`approved_by` bigint unsigned,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `employment_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_employment_contracts_trainee_id` UNIQUE(`trainee_id`),
	CONSTRAINT `chk_employment_contracts_status` CHECK(`status` in ('submitted', 'approved')),
	CONSTRAINT `chk_employment_contracts_file_size` CHECK(`file_size` between 1 and 52428800)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varbinary(32) NOT NULL,
	`expires_at` datetime NOT NULL,
	`last_used_at` datetime NOT NULL,
	`user_agent` varchar(255),
	`ip_address` varbinary(16),
	`created_at` datetime NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_sessions_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `trainees` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`company_id` bigint unsigned NOT NULL,
	`name` varchar(100) NOT NULL,
	`insurance_number` char(11) NOT NULL,
	`employment_type` varchar(32) NOT NULL,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `trainees_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_trainees_company_insurance` UNIQUE(`company_id`,`insurance_number`),
	CONSTRAINT `chk_trainees_employment_type` CHECK(`employment_type` in ('full_time', 'contract', 'part_time', 'dispatched', 'other'))
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` bigint unsigned NOT NULL,
	`role` varchar(32) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `user_roles_user_id_role_pk` PRIMARY KEY(`user_id`,`role`),
	CONSTRAINT `chk_user_roles_role` CHECK(`role` in ('client', 'staff', 'instructor', 'advisor', 'agency', 'admin'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`login_id` varchar(20) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`is_temporary_password` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`company_id` bigint unsigned,
	`agency_id` bigint unsigned,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_users_login_id` UNIQUE(`login_id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`freee_sign_document_id` bigint unsigned,
	`freee_sign_status` varchar(32),
	`sent_at` datetime,
	`canceled_at` datetime,
	`concluded_at` datetime,
	`pdf_file_key` varchar(512),
	`pdf_fetched_at` datetime,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_contracts_project_id` UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`generated_pdf_key` varchar(512),
	`generated_at` datetime,
	`sent_at` datetime,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_invoices_project_id` UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE TABLE `project_documents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`document_type` varchar(64) NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`content_type` varchar(100) NOT NULL,
	`file_size` bigint NOT NULL,
	`status` varchar(32) NOT NULL,
	`submitted_at` datetime NOT NULL,
	`approved_at` datetime,
	`approved_by` bigint unsigned,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `project_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_project_documents_project_type` UNIQUE(`project_id`,`document_type`),
	CONSTRAINT `chk_project_documents_status` CHECK(`status` in ('submitted', 'approved')),
	CONSTRAINT `chk_project_documents_file_size` CHECK(`file_size` between 1 and 52428800)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_number` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`company_id` bigint unsigned NOT NULL,
	`status` varchar(40) NOT NULL,
	`primary_staff_id` bigint unsigned,
	`primary_staff_name` varchar(100) NOT NULL,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_projects_project_number` UNIQUE(`project_number`),
	CONSTRAINT `chk_projects_status` CHECK(`status` in ('prospecting', 'verbal_agreement', 'subsidy_explained', 'contract_sent', 'contract_concluded', 'company_info_entry', 'employment_contract_pending', 'employment_contract_completed', 'new', 'schedule_confirmed', 'curriculum_selected', 'quotation_sent', 'quotation_received', 'invoice_sent', 'gbiz_guided', 'gbiz_registered', 'plan_submitted', 'payment_confirmed', 'training_in_progress', 'training_completed', 'subsidy_application_notified', 'documents_collecting', 'documents_collected', 'subsidy_application_completed', 'completed', 'inquiry'))
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`generated_pdf_key` varchar(512),
	`generated_at` datetime,
	`sent_at` datetime,
	`uploaded_file_key` varchar(512),
	`uploaded_filename` varchar(255),
	`uploaded_content_type` varchar(100),
	`uploaded_file_size` bigint,
	`uploaded_at` datetime,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_quotations_project_id` UNIQUE(`project_id`),
	CONSTRAINT `chk_quotations_uploaded_file_size` CHECK(`uploaded_file_size` between 1 and 52428800)
);
--> statement-breakpoint
CREATE TABLE `course_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`course_id` bigint unsigned NOT NULL,
	`session_symbol` varchar(16) NOT NULL,
	`display_order` int NOT NULL,
	`duration_hours` decimal(3,1) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `course_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_course_sessions_course_symbol` UNIQUE(`course_id`,`session_symbol`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`program_code` varchar(32) NOT NULL,
	`category_code` varchar(32) NOT NULL,
	`course_number` varchar(8) NOT NULL,
	`job_name` varchar(255) NOT NULL,
	`purpose` text NOT NULL,
	`display_order` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_courses_program_number` UNIQUE(`program_code`,`course_number`)
);
--> statement-breakpoint
CREATE TABLE `job_categories` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`display_order` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `job_categories_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `pattern_day_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`pattern_code` varchar(32) NOT NULL,
	`day_number` tinyint unsigned NOT NULL,
	`session_symbol` varchar(16) NOT NULL,
	`display_order` int NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `pattern_day_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_pattern_day_sessions_pattern_symbol` UNIQUE(`pattern_code`,`session_symbol`)
);
--> statement-breakpoint
CREATE TABLE `session_patterns` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`days` tinyint unsigned NOT NULL,
	`time_breakdown` varchar(255) NOT NULL,
	`display_order` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `session_patterns_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `training_programs` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`stage` varchar(32) NOT NULL,
	`subtitle` varchar(255),
	`display_order` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `training_programs_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `business_holidays` (
	`holiday_date` date NOT NULL,
	`note` varchar(255),
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `business_holidays_holiday_date` PRIMARY KEY(`holiday_date`)
);
--> statement-breakpoint
CREATE TABLE `reservation_days` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reservation_id` bigint unsigned NOT NULL,
	`day_number` tinyint unsigned NOT NULL,
	`lesson_date` date NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `reservation_days_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_reservation_days_reservation_day` UNIQUE(`reservation_id`,`day_number`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`pattern_code` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`requested_by` bigint unsigned,
	`requested_by_name` varchar(100) NOT NULL,
	`instructor_id` bigint unsigned,
	`instructor_name` varchar(100),
	`confirmed_at` datetime,
	`canceled_at` datetime,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_reservations_status` CHECK(`status` in ('requested', 'confirmed', 'canceled', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE `team_trainees` (
	`team_id` bigint unsigned NOT NULL,
	`trainee_id` bigint unsigned NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `team_trainees_team_id_trainee_id_pk` PRIMARY KEY(`team_id`,`trainee_id`),
	CONSTRAINT `uq_team_trainees_project_trainee` UNIQUE(`project_id`,`trainee_id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`reservation_id` bigint unsigned,
	`name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_teams_reservation_id` UNIQUE(`reservation_id`)
);
--> statement-breakpoint
CREATE TABLE `team_course_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`team_id` bigint unsigned NOT NULL,
	`session_symbol` varchar(16) NOT NULL,
	`display_order` int NOT NULL,
	`duration_hours` decimal(3,1) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`created_at` datetime NOT NULL,
	CONSTRAINT `team_course_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_team_course_sessions_team_symbol` UNIQUE(`team_id`,`session_symbol`)
);
--> statement-breakpoint
CREATE TABLE `team_courses` (
	`team_id` bigint unsigned NOT NULL,
	`program_code` varchar(32) NOT NULL,
	`category_code` varchar(32) NOT NULL,
	`pattern_code` varchar(32) NOT NULL,
	`source_course_id` bigint unsigned,
	`course_number` varchar(8) NOT NULL,
	`job_name` varchar(255) NOT NULL,
	`purpose` text NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `team_courses_team_id` PRIMARY KEY(`team_id`)
);
--> statement-breakpoint
CREATE TABLE `team_pattern_days` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`team_id` bigint unsigned NOT NULL,
	`day_number` tinyint unsigned NOT NULL,
	`session_symbol` varchar(16) NOT NULL,
	`display_order` int NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `team_pattern_days_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_team_pattern_days_team_symbol` UNIQUE(`team_id`,`session_symbol`)
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reservation_day_id` bigint unsigned NOT NULL,
	`trainee_id` bigint unsigned NOT NULL,
	`type` varchar(32) NOT NULL,
	`note` text,
	`created_at` datetime NOT NULL,
	`created_by` bigint unsigned,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_attendance_records_day_trainee` UNIQUE(`reservation_day_id`,`trainee_id`),
	CONSTRAINT `chk_attendance_records_type` CHECK(`type` in ('late', 'early_leave', 'absent'))
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` tinyint unsigned NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT false,
	`body` text,
	`updated_at` datetime NOT NULL,
	`updated_by` bigint unsigned,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_announcements_singleton` CHECK(`id` = 1)
);
--> statement-breakpoint
CREATE TABLE `board_post_attachments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`post_id` bigint unsigned NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`content_type` varchar(100) NOT NULL,
	`file_size` bigint NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `board_post_attachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_board_post_attachments_file_size` CHECK(`file_size` between 1 and 52428800)
);
--> statement-breakpoint
CREATE TABLE `board_posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`author_id` bigint unsigned,
	`author_name` varchar(100) NOT NULL,
	`body` text NOT NULL,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `board_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `board_read_states` (
	`project_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`last_read_at` datetime NOT NULL,
	CONSTRAINT `board_read_states_project_id_user_id_pk` PRIMARY KEY(`project_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`type` varchar(64) NOT NULL,
	`message` varchar(500) NOT NULL,
	`project_id` bigint unsigned,
	`reservation_id` bigint unsigned,
	`is_read` boolean NOT NULL DEFAULT false,
	`read_at` datetime,
	`created_at` datetime NOT NULL,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deletion_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`target_type` varchar(32) NOT NULL,
	`deleted_by` bigint unsigned,
	`deleted_by_name` varchar(100) NOT NULL,
	`deleted_at` datetime NOT NULL,
	`detail` json NOT NULL,
	CONSTRAINT `deletion_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_deletion_logs_target_type` CHECK(`target_type` in ('company', 'user', 'project'))
);
--> statement-breakpoint
CREATE TABLE `postal_codes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`postal_code` char(7) NOT NULL,
	`prefecture` varchar(50) NOT NULL,
	`city` varchar(100) NOT NULL,
	`town` varchar(255),
	`updated_at` datetime NOT NULL,
	CONSTRAINT `postal_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agencies` ADD CONSTRAINT `agencies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agencies` ADD CONSTRAINT `agencies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_referral_agency_id_agencies_id_fk` FOREIGN KEY (`referral_agency_id`) REFERENCES `agencies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_trainee_id_trainees_id_fk` FOREIGN KEY (`trainee_id`) REFERENCES `trainees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employment_contracts` ADD CONSTRAINT `employment_contracts_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainees` ADD CONSTRAINT `trainees_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainees` ADD CONSTRAINT `trainees_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainees` ADD CONSTRAINT `trainees_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_agency_id_agencies_id_fk` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_documents` ADD CONSTRAINT `project_documents_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_documents` ADD CONSTRAINT `project_documents_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_documents` ADD CONSTRAINT `project_documents_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_documents` ADD CONSTRAINT `project_documents_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_primary_staff_id_users_id_fk` FOREIGN KEY (`primary_staff_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_sessions` ADD CONSTRAINT `course_sessions_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_program_code_training_programs_code_fk` FOREIGN KEY (`program_code`) REFERENCES `training_programs`(`code`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_category_code_job_categories_code_fk` FOREIGN KEY (`category_code`) REFERENCES `job_categories`(`code`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pattern_day_sessions` ADD CONSTRAINT `pattern_day_sessions_pattern_code_session_patterns_code_fk` FOREIGN KEY (`pattern_code`) REFERENCES `session_patterns`(`code`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_holidays` ADD CONSTRAINT `business_holidays_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_holidays` ADD CONSTRAINT `business_holidays_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_days` ADD CONSTRAINT `reservation_days_reservation_id_reservations_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_pattern_code_session_patterns_code_fk` FOREIGN KEY (`pattern_code`) REFERENCES `session_patterns`(`code`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_instructor_id_users_id_fk` FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_trainees` ADD CONSTRAINT `team_trainees_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_trainees` ADD CONSTRAINT `team_trainees_trainee_id_trainees_id_fk` FOREIGN KEY (`trainee_id`) REFERENCES `trainees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_trainees` ADD CONSTRAINT `team_trainees_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_reservation_id_reservations_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_course_sessions` ADD CONSTRAINT `team_course_sessions_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_courses` ADD CONSTRAINT `team_courses_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_courses` ADD CONSTRAINT `team_courses_program_code_training_programs_code_fk` FOREIGN KEY (`program_code`) REFERENCES `training_programs`(`code`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_courses` ADD CONSTRAINT `team_courses_category_code_job_categories_code_fk` FOREIGN KEY (`category_code`) REFERENCES `job_categories`(`code`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_courses` ADD CONSTRAINT `team_courses_pattern_code_session_patterns_code_fk` FOREIGN KEY (`pattern_code`) REFERENCES `session_patterns`(`code`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_courses` ADD CONSTRAINT `team_courses_source_course_id_courses_id_fk` FOREIGN KEY (`source_course_id`) REFERENCES `courses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_pattern_days` ADD CONSTRAINT `team_pattern_days_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_reservation_day_id_reservation_days_id_fk` FOREIGN KEY (`reservation_day_id`) REFERENCES `reservation_days`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_trainee_id_trainees_id_fk` FOREIGN KEY (`trainee_id`) REFERENCES `trainees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_post_attachments` ADD CONSTRAINT `board_post_attachments_post_id_board_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `board_posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_posts` ADD CONSTRAINT `board_posts_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_posts` ADD CONSTRAINT `board_posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_read_states` ADD CONSTRAINT `board_read_states_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `board_read_states` ADD CONSTRAINT `board_read_states_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_reservation_id_reservations_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deletion_logs` ADD CONSTRAINT `deletion_logs_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_agencies_name` ON `agencies` (`name`);--> statement-breakpoint
CREATE INDEX `idx_companies_name` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `idx_companies_referral_agency_id` ON `companies` (`referral_agency_id`);--> statement-breakpoint
CREATE INDEX `idx_companies_created_at` ON `companies` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_companies_updated_at` ON `companies` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_employment_contracts_status` ON `employment_contracts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_trainees_name` ON `trainees` (`name`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_display_name` ON `users` (`display_name`);--> statement-breakpoint
CREATE INDEX `idx_users_is_active` ON `users` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_users_company_id` ON `users` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_users_agency_id` ON `users` (`agency_id`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_contracts_freee_sign_document_id` ON `contracts` (`freee_sign_document_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_pdf_fetched_at` ON `contracts` (`pdf_fetched_at`);--> statement-breakpoint
CREATE INDEX `idx_project_documents_status` ON `project_documents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_company_id` ON `projects` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_primary_staff_id` ON `projects` (`primary_staff_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_name` ON `projects` (`name`);--> statement-breakpoint
CREATE INDEX `idx_projects_updated_at` ON `projects` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_courses_category_code` ON `courses` (`category_code`);--> statement-breakpoint
CREATE INDEX `idx_reservation_days_date_time` ON `reservation_days` (`lesson_date`,`start_time`);--> statement-breakpoint
CREATE INDEX `idx_reservations_project_id` ON `reservations` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_reservations_status` ON `reservations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reservations_instructor_id` ON `reservations` (`instructor_id`);--> statement-breakpoint
CREATE INDEX `idx_team_trainees_trainee_id` ON `team_trainees` (`trainee_id`);--> statement-breakpoint
CREATE INDEX `idx_teams_project_id` ON `teams` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_board_post_attachments_post_id` ON `board_post_attachments` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_board_posts_project_created` ON `board_posts` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_deletion_logs_target_type` ON `deletion_logs` (`target_type`);--> statement-breakpoint
CREATE INDEX `idx_deletion_logs_deleted_at` ON `deletion_logs` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_postal_codes_postal_code` ON `postal_codes` (`postal_code`);