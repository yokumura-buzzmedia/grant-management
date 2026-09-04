import {
  type AnyMySqlColumn,
  check,
  date,
  datetime,
  index,
  mysqlTable,
  primaryKey,
  time,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { audit, fk, pk, timestamps, trainees, users } from "./core"
import { sessionPatterns } from "./curriculum"
import { RESERVATION_STATUSES, inList } from "./enums"
import { projects } from "./projects"

/** 休業日・予約・チーム（01_要件定義.md 5.5、5.6）。 */

// ---------------------------------------------------------------------------
// 休業日（01_要件定義.md 5.5）
// ---------------------------------------------------------------------------

/** 土日祝はシステム側で判定するため登録不要。本テーブルは個別の休業日のみを保持する。 */
export const businessHolidays = mysqlTable("business_holidays", {
  holidayDate: date("holiday_date", { mode: "string" }).primaryKey(),
  note: varchar("note", { length: 255 }),
  ...audit(),
})

// ---------------------------------------------------------------------------
// 予約枠（01_要件定義.md 5.5）
// ---------------------------------------------------------------------------

/**
 * 次のルールは DB 制約では表現できないため、アプリケーション側で検証する。
 * - 同一日時に確保できる予約枠数の上限は「有効な講師数 − 1」
 * - 1人の講師に同じ日時の講義を重複して割り当てない
 */
export const reservations = mysqlTable(
  "reservations",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    /** 受講日数の選択 */
    patternCode: varchar("pattern_code", { length: 32 })
      .notNull()
      .references((): AnyMySqlColumn => sessionPatterns.code, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 })
      .notNull()
      .$type<(typeof RESERVATION_STATUSES)[number]>(),
    requestedBy: fk("requested_by").references((): AnyMySqlColumn => users.id, {
      onDelete: "set null",
    }),
    /** 申請者名のスナップショット（04_DB論理設計.md 2.4） */
    requestedByName: varchar("requested_by_name", { length: 100 }).notNull(),
    /** 担当講師。事務員が承認時に指定する */
    instructorId: fk("instructor_id").references((): AnyMySqlColumn => users.id, {
      onDelete: "set null",
    }),
    /** 担当講師名のスナップショット */
    instructorName: varchar("instructor_name", { length: 100 }),
    confirmedAt: datetime("confirmed_at"),
    canceledAt: datetime("canceled_at"),
    ...audit(),
  },
  (t) => [
    index("idx_reservations_project_id").on(t.projectId),
    index("idx_reservations_status").on(t.status),
    index("idx_reservations_instructor_id").on(t.instructorId),
    check("chk_reservations_status", inList("status", RESERVATION_STATUSES)),
  ],
)

// ---------------------------------------------------------------------------
// 予約講義日（01_要件定義.md 5.5）
// ---------------------------------------------------------------------------

export const reservationDays = mysqlTable(
  "reservation_days",
  {
    id: pk(),
    reservationId: fk("reservation_id")
      .notNull()
      .references((): AnyMySqlColumn => reservations.id, { onDelete: "cascade" }),
    /** 1〜5 */
    dayNumber: tinyint("day_number", { unsigned: true }).notNull(),
    lessonDate: date("lesson_date", { mode: "string" }).notNull(),
    /** クライアントが選択する */
    startTime: time("start_time").notNull(),
    /** 開催パターンの時間配分から自動計算する */
    endTime: time("end_time").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_reservation_days_reservation_day").on(t.reservationId, t.dayNumber),
    /** 空き枠判定と講師の重複判定に使う */
    index("idx_reservation_days_date_time").on(t.lessonDate, t.startTime),
  ],
)

// ---------------------------------------------------------------------------
// チーム（01_要件定義.md 5.6）
// ---------------------------------------------------------------------------

/** 予約がキャンセル・却下された後もチームは残すため、reservation_id は NULL を許容する。 */
export const teams = mysqlTable(
  "teams",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    reservationId: fk("reservation_id").references((): AnyMySqlColumn => reservations.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    ...audit(),
  },
  (t) => [
    /** 1予約枠に1チーム */
    uniqueIndex("uq_teams_reservation_id").on(t.reservationId),
    index("idx_teams_project_id").on(t.projectId),
  ],
)

// ---------------------------------------------------------------------------
// チーム受講者（01_要件定義.md 5.6）
// ---------------------------------------------------------------------------

/**
 * 「同じ申請案件内では、1人の受講者を複数のチームに重複して登録できない」を
 * DB 側で担保するため、project_id を冗長に保持している。
 * 1チームあたりの人数制限は設けない。
 */
export const teamTrainees = mysqlTable(
  "team_trainees",
  {
    teamId: fk("team_id")
      .notNull()
      .references((): AnyMySqlColumn => teams.id, { onDelete: "cascade" }),
    traineeId: fk("trainee_id")
      .notNull()
      .references((): AnyMySqlColumn => trainees.id, { onDelete: "cascade" }),
    /** 下記の一意制約のために冗長保持する */
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.traineeId] }),
    uniqueIndex("uq_team_trainees_project_trainee").on(t.projectId, t.traineeId),
    index("idx_team_trainees_trainee_id").on(t.traineeId),
  ],
)
