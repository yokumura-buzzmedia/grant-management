import { sql } from "drizzle-orm"

/**
 * 区分値の定義。
 *
 * MySQL の ENUM 型は値の追加に ALTER TABLE を伴うため使用せず、
 * VARCHAR + CHECK 制約で表現する（docs/設計/04_DB論理設計.md 2.2）。
 * ここで定義した配列を CHECK 制約とアプリケーションの双方で共有する。
 */

/** 区分値の配列から CHECK 制約の式を組み立てる。値はすべて自前の定数のため、raw で展開してよい。 */
export const inList = (column: string, values: readonly string[]) =>
  sql.raw(`\`${column}\` in (${values.map((v) => `'${v}'`).join(", ")})`)

/** アカウントの権限（01_要件定義.md 5.4） */
export const USER_ROLES = [
  "client", // クライアント
  "staff", // 事務員
  "instructor", // 講師
  "advisor", // 社会保険労務士
  "agency", // 代理店
  "admin", // システム管理者
] as const
export type UserRole = (typeof USER_ROLES)[number]

/** 会社形態（01_要件定義.md 5.3） */
export const COMPANY_TYPES = [
  "corporation", // 株式会社
  "llc", // 合同会社
  "lp", // 合資会社
  "general_partnership", // 合名会社
  "sole_proprietor", // 個人事業主
  "other", // その他
] as const
export type CompanyType = (typeof COMPANY_TYPES)[number]

/** 雇用形態（01_要件定義.md 5.6） */
export const EMPLOYMENT_TYPES = [
  "full_time", // 正社員
  "contract", // 契約社員
  "part_time", // パート・アルバイト
  "dispatched", // 派遣
  "other", // その他
] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

/** 受講者の性別（01_要件定義.md 5.6） */
export const GENDERS = [
  "male", // 男性
  "female", // 女性
  "other", // その他
] as const
export type Gender = (typeof GENDERS)[number]

/**
 * 申請案件のステータス（01_要件定義.md 5、11_ステータスの遷移.drawio）
 *
 * 営業開始から支給申請までを1本の流れで管理する。会社にステータスは持たせない。
 * 助成金の受給までには半年から1年程度のラグがあるため、本システムでは受給を確認せず、
 * 支給申請の完了をもって completed（完了）として扱う（5.11）。
 * 完了後に問い合わせが発生した場合は inquiry へ変更し、対応が終われば completed へ戻す
 * （本フローで唯一、前の状態へ戻る遷移）。
 *
 * この一覧は暫定。GBiz・計画届・支給申請の各工程は要件定義書に記述がない。
 */
export const PROJECT_STATUSES = [
  "prospecting", // 1. 営業中
  "verbal_agreement", // 2. 内諾
  "subsidy_explained", // 3. 助成金説明済
  "contract_sent", // 4. 契約書送付済
  "contract_concluded", // 5. 契約締結済
  "company_info_entry", // 6. 必要事項記入中
  "employment_contract_pending", // 7. 雇用契約書提出中
  "employment_contract_completed", // 8. 雇用契約書提出済
  "schedule_confirmed", // 9. 日程調整済
  "curriculum_selected", // 10. カリキュラム選定済
  "quotation_sent", // 11. 見積もり兼発注書送付済
  "quotation_received", // 12. 見積もり兼発注書受領済
  "gbiz_guided", // 13. GBiz案内済
  "gbiz_registered", // 14. GBiz記入済
  "invoice_sent", // 15. 請求書送付済
  "plan_submitted", // 16. 計画届済
  "payment_confirmed", // 17. 入金確認済
  "training_in_progress", // 18. 研修中
  "training_completed", // 19. 研修完了
  "subsidy_application_notified", // 20. 支給申請連絡済
  "documents_collecting", // 21. 必要書類収集中
  "documents_collected", // 22. 必要書類収集完了
  "subsidy_application_completed", // 23. 助成金の支給申請完了
  "completed", // 24. 完了
  "inquiry", // 25. 問い合わせ。対応が終われば completed へ戻す
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/** 提出書類の状態（01_要件定義.md 5.2） */
export const DOCUMENT_STATUSES = [
  "submitted", // 提出済
  "approved", // 承認済
] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

/** 予約の状態（01_要件定義.md 5.5） */
export const RESERVATION_STATUSES = [
  "requested", // 申請中
  "confirmed", // 確定
  "canceled", // キャンセル
  "rejected", // 却下
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

/** 出欠の区分（01_要件定義.md 5.11）。出席は記録しない。 */
export const ATTENDANCE_TYPES = [
  "late", // 遅刻
  "early_leave", // 早退
  "absent", // 欠席
] as const
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number]

/** 削除履歴の対象種別（01_要件定義.md 5.3, 5.4, 5.15） */
export const DELETION_TARGET_TYPES = ["company", "user", "project"] as const
export type DeletionTargetType = (typeof DELETION_TARGET_TYPES)[number]

/** アップロードを許可するMIMEタイプ（01_要件定義.md 5.2） */
export const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const

/** 1ファイルあたりの最大サイズ（50MB / 01_要件定義.md 5.2） */
export const MAX_FILE_SIZE = 52_428_800
