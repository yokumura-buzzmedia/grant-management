import { sql } from "drizzle-orm"
import {
  type AnyMySqlColumn,
  bigint,
  boolean,
  char,
  check,
  datetime,
  index,
  int,
  mysqlTable,
  primaryKey,
  uniqueIndex,
  varbinary,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  COMPANY_TYPES,
  DOCUMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  MAX_FILE_SIZE,
  USER_ROLES,
  inList,
} from "./enums"

/**
 * アカウント・会社・受講者。
 *
 * これらは相互に参照し合うため、循環インポートを避けて1ファイルにまとめている。
 * 日時はすべて UTC で保存し、表示時に JST へ変換する（04_DB論理設計.md 2.2）。
 */

/** 主キー列 */
export const pk = (name = "id") =>
  bigint(name, { mode: "number", unsigned: true }).autoincrement().primaryKey()

/** 他テーブルを参照する ID 列 */
export const fk = (name: string) => bigint(name, { mode: "number", unsigned: true })

/**
 * 作成・更新情報の共通カラム（01_要件定義.md 5.17）。
 * created_by / updated_by が NULL の場合は「システム」による操作を意味する。
 * テーブルごとに新しいカラムビルダーが必要なため関数にしている。
 */
export const audit = () => ({
  createdAt: datetime("created_at").notNull(),
  createdBy: fk("created_by").references((): AnyMySqlColumn => users.id, { onDelete: "set null" }),
  updatedAt: datetime("updated_at").notNull(),
  updatedBy: fk("updated_by").references((): AnyMySqlColumn => users.id, { onDelete: "set null" }),
})

/** 作成・更新日時のみを持つテーブル用（マスタ・スナップショット） */
export const timestamps = () => ({
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
})

/** アップロードファイルの共通カラム。形式と容量は要件5.2で共通 */
export const uploadedFile = () => ({
  fileKey: varchar("file_key", { length: 512 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
})

// ---------------------------------------------------------------------------
// 代理店（01_要件定義.md 5.24）
// ---------------------------------------------------------------------------

export const agencies = mysqlTable(
  "agencies",
  {
    id: pk(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    /** 無効化すると、所属する代理店アカウントはすべてログインできない */
    isActive: boolean("is_active").notNull().default(true),
    ...audit(),
  },
  (t) => [uniqueIndex("uq_agencies_code").on(t.code), index("idx_agencies_name").on(t.name)],
)

// ---------------------------------------------------------------------------
// アカウント（01_要件定義.md 5.4）
// ---------------------------------------------------------------------------

export const users = mysqlTable(
  "users",
  {
    id: pk(),
    /** 半角英数字と - _ で6〜20文字。システム全体で一意、大文字小文字を区別する */
    loginId: varchar("login_id", { length: 20 }).notNull(),
    /** 画面表示用の利用者名 */
    displayName: varchar("display_name", { length: 100 }).notNull(),
    /** Argon2id のハッシュ */
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    /** 仮パスワード状態。true の間は通常機能を利用できない */
    isTemporaryPassword: boolean("is_temporary_password").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    /** クライアントアカウントの所属会社。作成後は変更しない */
    companyId: fk("company_id").references((): AnyMySqlColumn => companies.id, {
      onDelete: "cascade",
    }),
    /** 代理店アカウントの所属代理店 */
    agencyId: fk("agency_id").references((): AnyMySqlColumn => agencies.id, { onDelete: "restrict" }),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_users_login_id").on(t.loginId),
    index("idx_users_display_name").on(t.displayName),
    index("idx_users_is_active").on(t.isActive),
    index("idx_users_company_id").on(t.companyId),
    index("idx_users_agency_id").on(t.agencyId),
    index("idx_users_created_at").on(t.createdAt),
  ],
)

/**
 * アカウントの権限（多対多）。
 * 権限はセッションに保持せず、リクエストごとに本テーブルを参照する（要件5.19の即時反映）。
 */
export const userRoles = mysqlTable(
  "user_roles",
  {
    userId: fk("user_id")
      .notNull()
      .references((): AnyMySqlColumn => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull().$type<(typeof USER_ROLES)[number]>(),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.role] }),
    index("idx_user_roles_role").on(t.role),
    check("chk_user_roles_role", inList("role", USER_ROLES)),
  ],
)

/**
 * セッション（01_要件定義.md 5.19）。
 * トークンは平文を保存せず SHA-256 のハッシュのみを保持する。
 * 全端末ログアウトは user_id を条件とした削除で実現する。
 */
export const sessions = mysqlTable(
  "sessions",
  {
    id: pk(),
    userId: fk("user_id")
      .notNull()
      .references((): AnyMySqlColumn => users.id, { onDelete: "cascade" }),
    tokenHash: varbinary("token_hash", { length: 32 }).notNull().$type<Buffer>(),
    /** 発行時点から30日 */
    expiresAt: datetime("expires_at").notNull(),
    lastUsedAt: datetime("last_used_at").notNull(),
    userAgent: varchar("user_agent", { length: 255 }),
    ipAddress: varbinary("ip_address", { length: 16 }).$type<Buffer>(),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("uq_sessions_token_hash").on(t.tokenHash),
    index("idx_sessions_user_id").on(t.userId),
    index("idx_sessions_expires_at").on(t.expiresAt),
  ],
)

// ---------------------------------------------------------------------------
// 会社（01_要件定義.md 5.3）
// ---------------------------------------------------------------------------

/**
 * 一時保存を可能にするため、会社名以外はすべて NULL を許容する。
 * 必須チェックはアプリケーション側で行う。
 */
export const companies = mysqlTable(
  "companies",
  {
    id: pk(),
    name: varchar("name", { length: 255 }).notNull(),
    /** 法人番号。半角数字13桁。NULL は重複可 */
    corporateNumber: char("corporate_number", { length: 13 }),
    representativeName: varchar("representative_name", { length: 100 }),
    /** 業種は選択式ではなく自由入力 */
    industry: varchar("industry", { length: 100 }),
    companyType: varchar("company_type", { length: 32 }).$type<(typeof COMPANY_TYPES)[number]>(),
    employeeCount: int("employee_count", { unsigned: true }),
    /** 資本金（円） */
    capital: bigint("capital", { mode: "number" }),
    /** ハイフンなし7桁 */
    postalCode: char("postal_code", { length: 7 }),
    address: varchar("address", { length: 255 }),
    buildingName: varchar("building_name", { length: 255 }),
    /** ハイフンを含む入力を許可し、数字部分は10桁または11桁 */
    phone: varchar("phone", { length: 20 }),
    /** ログインアカウントとは別の会社主担当者情報 */
    contactName: varchar("contact_name", { length: 100 }),
    /** 契約書・見積もり兼発注書・請求書の送付先 */
    contactEmail: varchar("contact_email", { length: 255 }),
    /** 紹介代理店。任意項目 */
    referralAgencyId: fk("referral_agency_id").references((): AnyMySqlColumn => agencies.id, {
      onDelete: "restrict",
    }),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_companies_corporate_number").on(t.corporateNumber),
    index("idx_companies_name").on(t.name),
    index("idx_companies_referral_agency_id").on(t.referralAgencyId),
    index("idx_companies_created_at").on(t.createdAt),
    index("idx_companies_updated_at").on(t.updatedAt),
    check("chk_companies_company_type", inList("company_type", COMPANY_TYPES)),
    check("chk_companies_employee_count", sql.raw("`employee_count` >= 0")),
    check("chk_companies_capital", sql.raw("`capital` >= 0")),
  ],
)

// ---------------------------------------------------------------------------
// 受講者（01_要件定義.md 5.6）
// ---------------------------------------------------------------------------

/**
 * 受講者は会社に紐づく。3項目すべて必須。
 * 削除時は過去記録にも名前を残さないため、参照先はすべて CASCADE で削除する
 * （アカウントとは逆の方針 / 04_DB論理設計.md 2.4）。
 */
export const trainees = mysqlTable(
  "trainees",
  {
    id: pk(),
    companyId: fk("company_id")
      .notNull()
      .references((): AnyMySqlColumn => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    /** 氏名のフリガナ。全角カタカナ */
    nameKana: varchar("name_kana", { length: 100 }).notNull(),
    /** 雇用保険被保険者番号。ハイフンなし11桁 */
    insuranceNumber: char("insurance_number", { length: 11 }).notNull(),
    employmentType: varchar("employment_type", { length: 32 })
      .notNull()
      .$type<(typeof EMPLOYMENT_TYPES)[number]>(),
    /**
     * 職種。自由入力。
     * カリキュラムの職種カテゴリマスタとは結び付けない。マスタは研修コースを選ぶためのもので、
     * 受講者の実際の職種はそこに収まらない。
     */
    jobType: varchar("job_type", { length: 100 }).notNull(),
    /** 職務内容 */
    jobDescription: varchar("job_description", { length: 255 }).notNull(),
    gender: varchar("gender", { length: 16 }).notNull().$type<(typeof GENDERS)[number]>(),
    ...audit(),
  },
  (t) => [
    /** 同じ会社内での重複を禁止し、別会社では同一番号を許可する */
    uniqueIndex("uq_trainees_company_insurance").on(t.companyId, t.insuranceNumber),
    index("idx_trainees_name").on(t.name),
    check("chk_trainees_employment_type", inList("employment_type", EMPLOYMENT_TYPES)),
    check("chk_trainees_gender", inList("gender", GENDERS)),
  ],
)

/**
 * 受講者の雇用契約書（01_要件定義.md 5.2）。
 * 受講者1人につき1ファイル。承認は会社単位で一度だけ行い、
 * 同じ会社のすべての申請案件で承認済みとして扱う。
 * 差し替え時は同一行を更新して status を submitted に戻す（履歴は保持しない）。
 */
export const employmentContracts = mysqlTable(
  "employment_contracts",
  {
    id: pk(),
    traineeId: fk("trainee_id")
      .notNull()
      .references((): AnyMySqlColumn => trainees.id, { onDelete: "cascade" }),
    ...uploadedFile(),
    status: varchar("status", { length: 32 }).notNull().$type<(typeof DOCUMENT_STATUSES)[number]>(),
    submittedAt: datetime("submitted_at").notNull(),
    approvedAt: datetime("approved_at"),
    approvedBy: fk("approved_by").references((): AnyMySqlColumn => users.id, { onDelete: "set null" }),
    ...audit(),
  },
  (t) => [
    uniqueIndex("uq_employment_contracts_trainee_id").on(t.traineeId),
    index("idx_employment_contracts_status").on(t.status),
    check("chk_employment_contracts_status", inList("status", DOCUMENT_STATUSES)),
    check(
      "chk_employment_contracts_file_size",
      sql.raw(`\`file_size\` between 1 and ${MAX_FILE_SIZE}`),
    ),
  ],
)
