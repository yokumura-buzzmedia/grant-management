import { and, eq, ne, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { projects, userRoles, users, type UserRole } from "@/db/schema"

/**
 * アカウント操作の可否判定（01_要件定義.md 5.4, 5.16）。
 *
 * 予約が未実装のため、次はまだ判定できない。実装時に追加する。
 * - 今後の確定済み予約を担当している講師は、講師権限を解除できない
 *
 * 「完了していない申請案件の主担当は無効にできない」は countOpenProjectsAsStaff で判定する。
 * 事務員権限だけを外す経路（G-02 の権限編集）はまだ塞いでいない。
 */

export type TargetAccount = {
  id: number
  loginId: string
  displayName: string
  isActive: boolean
  /** 仮パスワードのまま。本人がまだ自分のパスワードを設定していない */
  isTemporaryPassword: boolean
  companyId: number | null
  roles: UserRole[]
}

/** 操作対象のアカウントを権限つきで取得する。 */
export const findAccount = async (userId: number): Promise<TargetAccount | null> => {
  const [row] = await db
    .select({
      id: users.id,
      loginId: users.loginId,
      displayName: users.displayName,
      isActive: users.isActive,
      isTemporaryPassword: users.isTemporaryPassword,
      companyId: users.companyId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row) return null

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))

  return { ...row, roles: roles.map((r) => r.role) }
}

/** 事務員はシステム管理者のアカウントを操作できない（5.4）。 */
export const canManage = (actorRoles: UserRole[], target: TargetAccount) =>
  actorRoles.includes("admin") || !target.roles.includes("admin")

/** 有効なシステム管理者の人数。自分以外に何人いるかの判定に使う。 */
export const countActiveAdmins = async (excludeUserId?: number) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "admin")))
    .where(
      excludeUserId
        ? and(eq(users.isActive, true), ne(users.id, excludeUserId))
        : eq(users.isActive, true),
    )
  return Number(row?.count ?? 0)
}

/**
 * その利用者が主担当で、まだ完了していない申請案件の件数（5.16）。
 *
 * 完了（completed）以外はすべて未完了として数える。問い合わせ（inquiry）も含む。
 * 完了後の問い合わせに対応している間も、担当者が動いている状態のため。
 */
export const countOpenProjectsAsStaff = async (userId: number) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(and(eq(projects.primaryStaffId, userId), ne(projects.status, "completed")))
  return Number(row?.count ?? 0)
}
