import { redirect } from "next/navigation"
import type { CurrentUser } from "@/lib/auth/current-user"
import { initialPath, requireActiveUser } from "@/lib/auth/guards"

/**
 * 会社情報（D-02）を編集できるか（06_画面設計.md 5）。
 *
 * 事務員とシステム管理者は全件（◎）。クライアントは自社分だけ（○）。
 * 会社は事務員が会社名だけで作り、残りは招待されたクライアントが入力する運用のため、
 * クライアントに編集権がないと会社情報が埋まらない（5.3）。
 */
export const canEditCompany = (user: CurrentUser, companyId: number) =>
  user.roles.includes("staff") ||
  user.roles.includes("admin") ||
  (user.roles.includes("client") && user.companyId === companyId)

/** 会社の一覧・作成・削除、クライアントアカウントの管理は事務員とシステム管理者だけ。 */
export const canManageCompanies = (user: CurrentUser) =>
  user.roles.includes("staff") || user.roles.includes("admin")

/**
 * 会社情報を編集できることを求める。
 *
 * クライアントは自社だけ。サーバーアクションの引数はクライアントから任意の値を渡せるため、
 * 画面を出し分けるだけでは足りず、更新処理でも同じ判定を通す。
 */
export const requireCompanyEditor = async (companyId: number): Promise<CurrentUser> => {
  const user = await requireActiveUser()
  if (!canEditCompany(user, companyId)) redirect(initialPath(user.roles))
  return user
}
