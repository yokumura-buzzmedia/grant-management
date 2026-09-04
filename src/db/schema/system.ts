import {
  type AnyMySqlColumn,
  check,
  char,
  datetime,
  index,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core"
import { fk, pk, users } from "./core"
import { DELETION_TARGET_TYPES, type DeletionTargetType, inList } from "./enums"

/** 削除履歴と郵便番号。 */

// ---------------------------------------------------------------------------
// 削除履歴（01_要件定義.md 5.3、5.4、5.15）
// ---------------------------------------------------------------------------

/** detail に保持する内容（対象種別ごとに異なる） */
export type DeletionDetail =
  | { companyName: string; corporateNumber: string | null }
  | { displayName: string; loginId: string }
  | { projectNumber: string; companyName: string }

/**
 * 会社・アカウント・申請案件の完全削除を記録する。
 * 本体は物理削除されるため、履歴側に必要な値を複製して保持する。
 * 本テーブルの行は削除できない（アプリケーションに削除機能を設けない）。
 * 削除理由は記録しない。
 */
export const deletionLogs = mysqlTable(
  "deletion_logs",
  {
    id: pk(),
    targetType: varchar("target_type", { length: 32 })
      .notNull()
      .$type<DeletionTargetType>(),
    deletedBy: fk("deleted_by").references((): AnyMySqlColumn => users.id, { onDelete: "set null" }),
    /** 削除した利用者名のスナップショット（04_DB論理設計.md 2.4） */
    deletedByName: varchar("deleted_by_name", { length: 100 }).notNull(),
    deletedAt: datetime("deleted_at").notNull(),
    detail: json("detail").$type<DeletionDetail>().notNull(),
  },
  (t) => [
    index("idx_deletion_logs_target_type").on(t.targetType),
    index("idx_deletion_logs_deleted_at").on(t.deletedAt),
    check("chk_deletion_logs_target_type", inList("target_type", DELETION_TARGET_TYPES)),
  ],
)

// ---------------------------------------------------------------------------
// 郵便番号（03_技術選定.md 4.10）
// ---------------------------------------------------------------------------

/**
 * 日本郵便の公開データを取り込み、月次で洗い替える。
 * 1つの郵便番号に複数の住所が対応するため、一意制約は付けない。
 */
export const postalCodes = mysqlTable(
  "postal_codes",
  {
    id: pk(),
    /** ハイフンなし7桁 */
    postalCode: char("postal_code", { length: 7 }).notNull(),
    prefecture: varchar("prefecture", { length: 50 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    town: varchar("town", { length: 255 }),
    updatedAt: datetime("updated_at").notNull(),
  },
  (t) => [index("idx_postal_codes_postal_code").on(t.postalCode)],
)
