import {
  type AnyMySqlColumn,
  datetime,
  decimal,
  int,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { fk } from "./core"
import { courses, jobCategories, sessionPatterns, trainingPrograms } from "./curriculum"
import { pk } from "./core"
import { teams } from "./scheduling"

/**
 * カリキュラムのスナップショット（01_要件定義.md 5.7）。
 *
 * チームにコースを紐づけた時点で内容を複製し、以後マスタが変更されても複製内容は変わらない。
 *
 * 複製する  : コース内容、講義コマ、パターン日別コマ割当
 * 複製しない: 研修プログラム名、職種カテゴリ名（マスタの最新の名称を表示する）
 */

// ---------------------------------------------------------------------------
// チームのコース内容
// ---------------------------------------------------------------------------

export const teamCourses = mysqlTable("team_courses", {
  /** 1チーム1カリキュラム */
  teamId: fk("team_id")
    .primaryKey()
    .references((): AnyMySqlColumn => teams.id, { onDelete: "cascade" }),
  /** 参照のまま保持する。名称はマスタから取得する */
  programCode: varchar("program_code", { length: 32 })
    .notNull()
    .references((): AnyMySqlColumn => trainingPrograms.code, { onDelete: "restrict" }),
  /** 参照のまま保持する。名称はマスタから取得する */
  categoryCode: varchar("category_code", { length: 32 })
    .notNull()
    .references((): AnyMySqlColumn => jobCategories.code, { onDelete: "restrict" }),
  patternCode: varchar("pattern_code", { length: 32 })
    .notNull()
    .references((): AnyMySqlColumn => sessionPatterns.code, { onDelete: "restrict" }),
  /** 複製元のコース。追跡用（マスタ削除時は NULL） */
  sourceCourseId: fk("source_course_id").references((): AnyMySqlColumn => courses.id, {
    onDelete: "set null",
  }),
  /** 以下は複製した内容 */
  courseNumber: varchar("course_number", { length: 8 }).notNull(),
  jobName: varchar("job_name", { length: 255 }).notNull(),
  purpose: text("purpose").notNull(),
  /** 複製した日時 */
  createdAt: datetime("created_at").notNull(),
})

// ---------------------------------------------------------------------------
// チームの講義コマ内容（1チームあたり13件）
// ---------------------------------------------------------------------------

export const teamCourseSessions = mysqlTable(
  "team_course_sessions",
  {
    id: pk(),
    teamId: fk("team_id")
      .notNull()
      .references((): AnyMySqlColumn => teams.id, { onDelete: "cascade" }),
    sessionSymbol: varchar("session_symbol", { length: 16 }).notNull(),
    displayOrder: int("display_order").notNull(),
    durationHours: decimal("duration_hours", { precision: 3, scale: 1 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [uniqueIndex("uq_team_course_sessions_team_symbol").on(t.teamId, t.sessionSymbol)],
)

// ---------------------------------------------------------------------------
// チームの日別コマ割当
// ---------------------------------------------------------------------------

export const teamPatternDays = mysqlTable(
  "team_pattern_days",
  {
    id: pk(),
    teamId: fk("team_id")
      .notNull()
      .references((): AnyMySqlColumn => teams.id, { onDelete: "cascade" }),
    dayNumber: tinyint("day_number", { unsigned: true }).notNull(),
    sessionSymbol: varchar("session_symbol", { length: 16 }).notNull(),
    displayOrder: int("display_order").notNull(),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [uniqueIndex("uq_team_pattern_days_team_symbol").on(t.teamId, t.sessionSymbol)],
)
