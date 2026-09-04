import { sql } from "drizzle-orm"
import {
  type AnyMySqlColumn,
  bigint,
  check,
  datetime,
  index,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { audit, companies, fk, pk, uploadedFile, users } from "./core"
import { DOCUMENT_STATUSES, MAX_FILE_SIZE, PROJECT_STATUSES, inList } from "./enums"

/** 申請案件と、案件に紐づく書類・帳票。 */

// ---------------------------------------------------------------------------
// 申請案件（01_要件定義.md 5、5.15、5.16）
// ---------------------------------------------------------------------------

export const projects = mysqlTable(
  "projects",
  {
    id: pk(),
    /** 作成時に自動発行する案件番号 */
    projectNumber: varchar("project_number", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    companyId: fk("company_id")
      .notNull()
      .references((): AnyMySqlColumn => companies.id, { onDelete: "cascade" }),
    /** 営業中から完了までを1本の流れで管理する。会社にステータスは持たせない */
    status: varchar("status", { length: 40 }).notNull().$type<(typeof PROJECT_STATUSES)[number]>(),
    primaryStaffId: fk("primary_staff_id").references((): AnyMySqlColumn => users.id, {
      onDelete: "set null",
    }),
    /** 主担当者名のスナップショット。アカウント削除後も表示を維持する（要件5.4） */
    primaryStaffName: varchar("primary_staff_name", { length: 100 }).notNull(),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_projects_project_number").on(t.projectNumber),
    index("idx_projects_company_id").on(t.companyId),
    index("idx_projects_status").on(t.status),
    index("idx_projects_primary_staff_id").on(t.primaryStaffId),
    index("idx_projects_name").on(t.name),
    index("idx_projects_updated_at").on(t.updatedAt),
    check("chk_projects_status", inList("status", PROJECT_STATUSES)),
  ],
)

// ---------------------------------------------------------------------------
// 案件共通の必要書類（01_要件定義.md 5.2）
// ---------------------------------------------------------------------------

/**
 * 必要書類の種類はマスタを設けず、コード側の定数で管理する。
 * 本テーブルは提出されたファイルのみを保持し、行が存在しない書類種別は未提出として扱う。
 */
export const projectDocuments = mysqlTable(
  "project_documents",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    /** 書類種別コード。定数はアプリケーション側で管理する */
    documentType: varchar("document_type", { length: 64 }).notNull(),
    ...uploadedFile(),
    status: varchar("status", { length: 32 }).notNull().$type<(typeof DOCUMENT_STATUSES)[number]>(),
    submittedAt: datetime("submitted_at").notNull(),
    approvedAt: datetime("approved_at"),
    approvedBy: fk("approved_by").references((): AnyMySqlColumn => users.id, { onDelete: "set null" }),
    ...audit(),
  },
  (t) => [
    /** 1種類につき1ファイル */
    uniqueIndex("uq_project_documents_project_type").on(t.projectId, t.documentType),
    index("idx_project_documents_status").on(t.status),
    check("chk_project_documents_status", inList("status", DOCUMENT_STATUSES)),
    check("chk_project_documents_file_size", sql.raw(`\`file_size\` between 1 and ${MAX_FILE_SIZE}`)),
  ],
)

// ---------------------------------------------------------------------------
// 契約書（01_要件定義.md 5.8）
// ---------------------------------------------------------------------------

/**
 * FREE SIGN（freeeサイン）と連携する。1申請案件につき1件。
 *
 * Webhook は使用せず、ポーリングのみで締結を検知する（05_外部連携仕様.md）。
 * 送付済み・未取消・PDF未取得の行を抽出し、freee_sign_document_id をまとめて
 * GET /v1/documents の ids[] に渡す。前回実行時刻は保持しない。
 */
export const contracts = mysqlTable(
  "contracts",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    /** freeeサインの文書ID。ポーリング時に ids[] へ渡す */
    freeeSignDocumentId: bigint("freee_sign_document_id", { mode: "number", unsigned: true }),
    /** freeeサイン側のステータス。concluded で締結完了 */
    freeeSignStatus: varchar("freee_sign_status", { length: 32 }),
    sentAt: datetime("sent_at"),
    canceledAt: datetime("canceled_at"),
    concludedAt: datetime("concluded_at"),
    pdfFileKey: varchar("pdf_file_key", { length: 512 }),
    /** NULL の場合はポーリング対象 */
    pdfFetchedAt: datetime("pdf_fetched_at"),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_contracts_project_id").on(t.projectId),
    index("idx_contracts_freee_sign_document_id").on(t.freeeSignDocumentId),
    index("idx_contracts_pdf_fetched_at").on(t.pdfFetchedAt),
  ],
)

// ---------------------------------------------------------------------------
// 見積もり兼発注書（01_要件定義.md 5.9）
// ---------------------------------------------------------------------------

/**
 * 見積書と発注書は分けず1つの帳票として扱う。
 * システムが自動生成した PDF と、クライアントが署名・押印して提出したファイルを保持する。
 * 差し替え時は同一行を更新し、履歴は保持しない。
 */
export const quotations = mysqlTable(
  "quotations",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    generatedPdfKey: varchar("generated_pdf_key", { length: 512 }),
    generatedAt: datetime("generated_at"),
    /** 生成しただけでは送付しない。送付操作を実行したときのみ設定する */
    sentAt: datetime("sent_at"),
    uploadedFileKey: varchar("uploaded_file_key", { length: 512 }),
    uploadedFilename: varchar("uploaded_filename", { length: 255 }),
    uploadedContentType: varchar("uploaded_content_type", { length: 100 }),
    uploadedFileSize: bigint("uploaded_file_size", { mode: "number" }),
    uploadedAt: datetime("uploaded_at"),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_quotations_project_id").on(t.projectId),
    check(
      "chk_quotations_uploaded_file_size",
      sql.raw(`\`uploaded_file_size\` between 1 and ${MAX_FILE_SIZE}`),
    ),
  ],
)

// ---------------------------------------------------------------------------
// 請求書（01_要件定義.md 5.10）
// ---------------------------------------------------------------------------

/** 入金確認はステータスの進行で表現するため、専用の列は持たない。 */
export const invoices = mysqlTable(
  "invoices",
  {
    id: pk(),
    projectId: fk("project_id")
      .notNull()
      .references((): AnyMySqlColumn => projects.id, { onDelete: "cascade" }),
    generatedPdfKey: varchar("generated_pdf_key", { length: 512 }),
    generatedAt: datetime("generated_at"),
    sentAt: datetime("sent_at"),
    ...audit(),
  },
  (t) => [uniqueIndex("uq_invoices_project_id").on(t.projectId)],
)
