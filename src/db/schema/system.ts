import { sql } from "drizzle-orm"
import {
  type AnyMySqlColumn,
  check,
  char,
  datetime,
  index,
  json,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { fk, pk, timestamps, users } from "./core"
import { DELETION_TARGET_TYPES, type DeletionTargetType, inList } from "./enums"

/** 削除履歴と郵便番号、外部連携のトークン。 */

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

// ---------------------------------------------------------------------------
// freeeサインのトークン（05_外部連携仕様.md 3.2）
// ---------------------------------------------------------------------------

/**
 * freeeサインは OAuth 2.0 の認可コードフローしか提供していない。
 * サーバー間だけで完結する付与方式（client_credentials）が無いため、
 * 管理者が一度ブラウザで認可し、得たトークンをここに保管して以後は自動で更新する。
 *
 * **リフレッシュトークンは更新のたびに新しくなる。** 前のものは使えなくなるので、
 * 保管場所は1か所でなければならない。プロセス内に持つとタスクを増やした瞬間に壊れる。
 *
 * 行は常に1つ。`singleton` の一意制約で、2つ目が入らないようにする。
 */
export const freeeSignTokens = mysqlTable(
  "freee_sign_tokens",
  {
    id: pk(),
    /** 常に "x"。1行しか作らせないための列 */
    singleton: char("singleton", { length: 1 }).notNull().default("x"),
    accessToken: varchar("access_token", { length: 2048 }).notNull(),
    /** 期限切れの手前で更新する。UTC */
    accessTokenExpiresAt: datetime("access_token_expires_at").notNull(),
    refreshToken: varchar("refresh_token", { length: 2048 }).notNull(),
    /** 認可した利用者。削除されても誰が繋いだかを残す（04_DB論理設計.md 2.4） */
    authorizedBy: fk("authorized_by").references((): AnyMySqlColumn => users.id, {
      onDelete: "set null",
    }),
    authorizedByName: varchar("authorized_by_name", { length: 100 }).notNull(),
    authorizedAt: datetime("authorized_at").notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_freee_sign_tokens_singleton").on(t.singleton),
    check("chk_freee_sign_tokens_singleton", sql.raw("`singleton` = 'x'")),
  ],
)
