import { and, eq, ne, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { userRoles, users, type UserRole } from "@/db/schema"

/**
 * アカウント操作の可否判定（01_要件定義.md 5.4）。
 *
 * 申請案件・予約が未実装のため、次の2つはまだ判定できない。実装時に追加する。
 * - 完了していない申請案件の主担当の事務員は、無効化・事務員権限の解除ができない
 * - 今後の確定済み予約を担当している講師は、講師権限を解除できない
 */

export type TargetAccount = {
  id: number
  loginId: string
  displayName: string
  isActive: boolean
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
