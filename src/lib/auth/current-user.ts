import { cache } from "react"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { sessions, userRoles, users, type UserRole } from "@/db/schema"
import { now } from "@/lib/datetime"
import { hashSessionToken, readSessionToken, touchSession } from "./session"

export type CurrentUser = {
  id: number
  loginId: string
  displayName: string
  isTemporaryPassword: boolean
  companyId: number | null
  agencyId: number | null
  /** 権限はセッションに含めず、リクエストごとに user_roles を参照する（5.19） */
  roles: UserRole[]
}

/**
 * 現在のログイン利用者。
 *
 * React の cache により、1リクエスト内では何度呼んでも問い合わせは1回で済む。
 * 一方でリクエストをまたいだキャッシュは行わないため、権限の追加・変更・解除と
 * アカウントの無効化が次のリクエストから直ちに反映される（5.19）。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken()
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastUsedAt: sessions.lastUsedAt,
      id: users.id,
      loginId: users.loginId,
      displayName: users.displayName,
      isTemporaryPassword: users.isTemporaryPassword,
      isActive: users.isActive,
      companyId: users.companyId,
      agencyId: users.agencyId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1)

  if (!row) return null

  // 期限切れ（ログイン時点から30日）
  if (row.expiresAt.getTime() <= now().getTime()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId))
    return null
  }

  // 無効化されたアカウントは直ちにログアウトさせる（5.19）
  if (!row.isActive) {
    await db.delete(sessions).where(eq(sessions.userId, row.id))
    return null
  }

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, row.id))

  await touchSession(row.sessionId, row.lastUsedAt)

  return {
    id: row.id,
    loginId: row.loginId,
    displayName: row.displayName,
    isTemporaryPassword: row.isTemporaryPassword,
    companyId: row.companyId,
    agencyId: row.agencyId,
    roles: roles.map((r) => r.role),
  }
})
