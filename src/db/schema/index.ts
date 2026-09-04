/**
 * 助成金管理システム データベーススキーマ
 *
 * 全34テーブル。設計の根拠は docs/設計/04_DB論理設計.md を参照。
 *
 * - 文字コード utf8mb4 / 照合順序 utf8mb4_ja_0900_as_cs
 * - 日時はすべて UTC で保存し、表示時に JST へ変換する
 * - 論理削除は使わず、すべて物理削除とする
 * - アカウント削除時は表示名のスナップショットを残し、受講者削除時は残さない
 */

export * from "./enums"
export * from "./core" // agencies, users, user_roles, sessions, companies, trainees, employment_contracts
export * from "./projects" // projects, project_documents, contracts, quotations, invoices
export * from "./curriculum" // training_programs, job_categories, courses, course_sessions, session_patterns, pattern_day_sessions
export * from "./scheduling" // business_holidays, reservations, reservation_days, teams, team_trainees
export * from "./snapshots" // team_courses, team_course_sessions, team_pattern_days
export * from "./attendance" // attendance_records
export * from "./communication" // board_posts, board_post_attachments, board_read_states, notifications, announcements
export * from "./system" // deletion_logs, postal_codes
