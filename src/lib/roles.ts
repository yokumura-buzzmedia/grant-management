import type { UserRole } from "@/db/schema"

/** 権限の表示名（01_要件定義.md 3）。クライアントコンポーネントでも使う。 */
export const ROLE_LABELS: Record<UserRole, string> = {
  client: "クライアント",
  staff: "事務員",
  instructor: "講師",
  advisor: "社会保険労務士",
  agency: "代理店",
  admin: "システム管理者",
}

/**
 * G-02 で作成できるアカウントの権限（5.4）。
 *
 * - 講師・社労士は、事務員またはシステム管理者が作成する
 * - 事務員アカウントは、システム管理者が作成する
 * - システム管理者アカウントは、既存のシステム管理者が作成する
 *
 * クライアントは所属会社が必ず1社に決まるため、会社詳細（D-02）から作成する。
 * 代理店は代理店マスタ（未実装）に紐づける必要があるため、当面は作成できない。
 */
export const creatableRoles = (actorRoles: UserRole[]): UserRole[] =>
  actorRoles.includes("admin")
    ? ["staff", "instructor", "advisor", "admin"]
    : ["instructor", "advisor"]
