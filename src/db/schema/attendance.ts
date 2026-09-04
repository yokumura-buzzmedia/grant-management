import {
  type AnyMySqlColumn,
  check,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { audit, fk, pk, trainees } from "./core"
import { ATTENDANCE_TYPES, inList } from "./enums"
import { reservationDays } from "./scheduling"

/**
 * 出欠記録（01_要件定義.md 5.11）。
 *
 * 全受講者を「出席」として扱うことが既定のため、
 * 遅刻・早退・欠席が発生した場合のみ行を作成する。
 * 行が存在しない受講者は出席とみなす。
 *
 * チームは reservation_day → reservation → team の経路で特定できるため列は持たない。
 * 遅刻・早退の時刻や受講できなかった時間は記録しない。
 */
export const attendanceRecords = mysqlTable(
  "attendance_records",
  {
    id: pk(),
    /** 講義日 */
    reservationDayId: fk("reservation_day_id")
      .notNull()
      .references((): AnyMySqlColumn => reservationDays.id, { onDelete: "cascade" }),
    traineeId: fk("trainee_id")
      .notNull()
      .references((): AnyMySqlColumn => trainees.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull().$type<(typeof ATTENDANCE_TYPES)[number]>(),
    /** 補足が必要な場合の自由入力 */
    note: text("note"),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_attendance_records_day_trainee").on(t.reservationDayId, t.traineeId),
    check("chk_attendance_records_type", inList("type", ATTENDANCE_TYPES)),
  ],
)
