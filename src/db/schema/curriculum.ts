import {
  type AnyMySqlColumn,
  boolean,
  decimal,
  index,
  int,
  mysqlTable,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { fk, pk, timestamps } from "./core"

/**
 * カリキュラムマスタ（01_要件定義.md 5.7）。
 *
 * 6つのマスタで構成する。初期データは docs/data/ の CSV から投入する。
 * チームから参照されているマスタは削除できず、無効化のみ可能とする。
 * 各マスタのコードは登録後に変更しない。
 */

// ---------------------------------------------------------------------------
// 研修プログラムマスタ（初期データ2件）
// ---------------------------------------------------------------------------

export const trainingPrograms = mysqlTable("training_programs", {
  code: varchar("code", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  /** 段階（例: 第1段階） */
  stage: varchar("stage", { length: 32 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  displayOrder: int("display_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
})

// ---------------------------------------------------------------------------
// 職種カテゴリマスタ（初期データ7件）
// ---------------------------------------------------------------------------

export const jobCategories = mysqlTable("job_categories", {
  code: varchar("code", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  displayOrder: int("display_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
})

// ---------------------------------------------------------------------------
// コースマスタ（初期データ132件 = 1プログラムあたり66コース）
// ---------------------------------------------------------------------------

export const courses = mysqlTable(
  "courses",
  {
    id: pk(),
    programCode: varchar("program_code", { length: 32 })
      .notNull()
      .references((): AnyMySqlColumn => trainingPrograms.code, { onDelete: "restrict" }),
    categoryCode: varchar("category_code", { length: 32 })
      .notNull()
      .references((): AnyMySqlColumn => jobCategories.code, { onDelete: "restrict" }),
    courseNumber: varchar("course_number", { length: 8 }).notNull(),
    /** 職種名 */
    jobName: varchar("job_name", { length: 255 }).notNull(),
    /** 目的。プレーンテキストで登録し、文字装飾は保持しない */
    purpose: text("purpose").notNull(),
    displayOrder: int("display_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    /** CSV の識別キーと一致させる */
    uniqueIndex("uq_courses_program_number").on(t.programCode, t.courseNumber),
    index("idx_courses_category_code").on(t.categoryCode),
  ],
)

// ---------------------------------------------------------------------------
// 講義コママスタ（初期データ1,716件 = 132コース × 13コマ）
// ---------------------------------------------------------------------------

/**
 * 1コースは13コマで構成し、所要時間の合計は10時間。
 * この2点はアプリケーション側で検証する。
 */
export const courseSessions = mysqlTable(
  "course_sessions",
  {
    id: pk(),
    courseId: fk("course_id")
      .notNull()
      .references((): AnyMySqlColumn => courses.id, { onDelete: "cascade" }),
    /** コマ記号 */
    sessionSymbol: varchar("session_symbol", { length: 16 }).notNull(),
    displayOrder: int("display_order").notNull(),
    /** 所要時間。0.5時間単位 */
    durationHours: decimal("duration_hours", { precision: 3, scale: 1 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uq_course_sessions_course_symbol").on(t.courseId, t.sessionSymbol)],
)

// ---------------------------------------------------------------------------
// 開催パターンマスタ（初期データ4件）
// ---------------------------------------------------------------------------

export const sessionPatterns = mysqlTable("session_patterns", {
  code: varchar("code", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  /** 受講日数（2〜5） */
  days: tinyint("days", { unsigned: true }).notNull(),
  /** 時間内訳（例: 3時間/3時間/4時間） */
  timeBreakdown: varchar("time_breakdown", { length: 255 }).notNull(),
  displayOrder: int("display_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
})

// ---------------------------------------------------------------------------
// パターン日別コマ割当マスタ（初期データ52件 = 4パターン × 13コマ）
// ---------------------------------------------------------------------------

/** 開催パターンごとに、各講義日へ割り当てる講義コマを定義する。全コースで共通。 */
export const patternDaySessions = mysqlTable(
  "pattern_day_sessions",
  {
    id: pk(),
    patternCode: varchar("pattern_code", { length: 32 })
      .notNull()
      .references((): AnyMySqlColumn => sessionPatterns.code, { onDelete: "cascade" }),
    /** 何日目か */
    dayNumber: tinyint("day_number", { unsigned: true }).notNull(),
    /** コマ記号。コースに依存しない共通の記号 */
    sessionSymbol: varchar("session_symbol", { length: 16 }).notNull(),
    displayOrder: int("display_order").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uq_pattern_day_sessions_pattern_symbol").on(t.patternCode, t.sessionSymbol)],
)
