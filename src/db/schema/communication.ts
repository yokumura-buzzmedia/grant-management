import { sql } from "drizzle-orm"
import {
  type AnyMySqlColumn,
  bigint,
  boolean,
  check,
  datetime,
  index,
  mysqlTable,
  primaryKey,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { fk, pk, uploadedFile, users } from "./core"
import { MAX_FILE_SIZE } from "./enums"
import { projects } from "./projects"
import { reservations } from "./scheduling"

/** 案件掲示板・共通通知・お知らせ（01_要件定義.md 5.12、5.13、5.23）。 */

// ---------------------------------------------------------------------------
// 案件掲示板の投稿（01_要件定義.md 5.12）
// ---------------------------------------------------------------------------

/** 投稿者本人のみ編集・削除できる。代理店は閲覧のみで投稿できない。 */
export const boardPosts = mysqlTable(
  "board_posts",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    authorId: fk("author_id").references((): AnyMySqlColumn => users.id, { onDelete: "set null" }),
    /** 投稿者名のスナップショット。アカウント削除後も表示を維持する（04_DB論理設計.md 2.4） */
    authorName: varchar("author_name", { length: 100 }).notNull(),
    body: text("body").notNull(),
    createdAt: datetime("created_at").notNull(),
    updatedAt: datetime("updated_at").notNull(),
  },
  (t) => [index("idx_board_posts_project_created").on(t.projectId, t.createdAt)],
)

export const boardPostAttachments = mysqlTable(
  "board_post_attachments",
  {
    id: pk(),
    postId: fk("post_id")
      .notNull()
      .references((): AnyMySqlColumn => boardPosts.id, { onDelete: "cascade" }),
    ...uploadedFile(),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [
    index("idx_board_post_attachments_post_id").on(t.postId),
    check(
      "chk_board_post_attachments_file_size",
      sql.raw(`\`file_size\` between 1 and ${MAX_FILE_SIZE}`),
    ),
  ],
)

/**
 * 掲示板の既読状態（01_要件定義.md 5.12）。
 * 未読の判定は「last_read_at より新しい、自分以外の投稿が存在するか」で行う。
 */
export const boardReadStates = mysqlTable(
  "board_read_states",
  {
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    userId: fk("user_id")
      .notNull()
      .references((): AnyMySqlColumn => users.id, { onDelete: "cascade" }),
    /** 最後に掲示板タブを開いた日時 */
    lastReadAt: datetime("last_read_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
)

// ---------------------------------------------------------------------------
// 共通通知（01_要件定義.md 5.13）
// ---------------------------------------------------------------------------

/**
 * 掲示板の投稿は対象外。過去の通知は自動削除しない。
 * 代理店には通知を作成しない。
 */
export const notifications = mysqlTable(
  "notifications",
  {
    id: pk(),
    userId: fk("user_id")
      .notNull()
      .references((): AnyMySqlColumn => users.id, { onDelete: "cascade" }),
    /** 通知種別（書類提出、予約確定など） */
    type: varchar("type", { length: 64 }).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    /** 遷移先の申請案件 */
    projectId: fk("project_id").references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    /** 遷移先の予約 */
    reservationId: fk("reservation_id").references((): AnyMySqlColumn => reservations.id, {
      onDelete: "cascade",
    }),
    isRead: boolean("is_read").notNull().default(false),
    readAt: datetime("read_at"),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [index("idx_notifications_user_read_created").on(t.userId, t.isRead, t.createdAt)],
)

// ---------------------------------------------------------------------------
// お知らせ（01_要件定義.md 5.23）
// ---------------------------------------------------------------------------

/**
 * 同時に表示できるお知らせは1件のみのため、単一行を更新して使用する。
 * OFF の間も内容を保持する。閉じた状態は保存しないため、関連テーブルは設けない。
 * body は文字装飾とリンクを含む HTML。保存時に必ずサニタイズして XSS を防ぐ。
 */
export const announcements = mysqlTable(
  "announcements",
  {
    /** 常に 1 */
    id: tinyint("id", { unsigned: true }).primaryKey(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    /** 最大1,000文字（表示文字数で判定する） */
    body: text("body"),
    updatedAt: datetime("updated_at").notNull(),
    updatedBy: bigint("updated_by", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
      { onDelete: "set null" },
    ),
  },
  () => [check("chk_announcements_singleton", sql.raw("`id` = 1"))],
)
