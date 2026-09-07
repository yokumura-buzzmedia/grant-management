import { redirect } from "next/navigation"
import type { UserRole } from "@/db/schema"
import { getCurrentUser, type CurrentUser } from "./current-user"

/** ログインしていなければログイン画面へ送る。 */
export const requireUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

/**
 * 仮パスワードのままでは通常機能を利用できない（5.4）。
 * 新しいパスワードを設定するまで A-02 へ送り続ける。
 */
export const requireActiveUser = async (): Promise<CurrentUser> => {
  const user = await requireUser()
  if (user.isTemporaryPassword) redirect("/password/setup")
  return user
}

/**
 * 指定した権限のいずれかを持つことを求める。
 * 権限が足りない場合は、そのアカウントの初期表示画面へ戻す。
 */
export const requireRoles = async (allowed: readonly UserRole[]): Promise<CurrentUser> => {
  const user = await requireActiveUser()
  if (!allowed.some((role) => user.roles.includes(role))) redirect(initialPath(user.roles))
  return user
}

/**
 * ログイン後の最初の画面（5.14 / 06_画面設計.md 3）。
 * 複数の権限を持つ場合は事務員・システム管理者を優先する。
 */
export const initialPath = (roles: UserRole[]) => {
  if (roles.includes("admin") || roles.includes("staff")) return "/dashboard"
  if (roles.includes("advisor")) return "/dashboard"
  if (roles.includes("instructor")) return "/schedule"
  return "/projects" // クライアント・代理店
}
