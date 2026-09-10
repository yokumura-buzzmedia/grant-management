import { eq, sql } from "drizzle-orm"
import { companies, projects } from "@/db/schema"
import type { CurrentUser } from "@/lib/auth/current-user"

/**
 * 申請案件の見える範囲（06_画面設計.md 5 の権限マトリクス）。
 *
 * | 権限 | 範囲 |
 * | --- | --- |
 * | 事務員・システム管理者・社労士 | 全件 |
 * | クライアント | 自社の案件 |
 * | 代理店 | 自社が紹介した会社の案件 |
 *
 * **クライアントに会社が、代理店に代理店が紐づいていないときは1件も出さない。**
 * 絞り込みの条件を落として全件が見えるほうが危険なため。
 *
 * 一覧・詳細・契約書PDFの3か所で使う。判定を写して持つと、
 * どれか1つを直し忘れたときに見えてはいけないものが見える。
 *
 * 代理店の条件は `companies` を参照するので、**使う側は companies を join すること。**
 * 返り値が `undefined` のときは絞り込み不要（全件）。
 */
export const projectScope = (user: CurrentUser) => {
  const canSeeAll =
    user.roles.includes("staff") || user.roles.includes("admin") || user.roles.includes("advisor")
  if (canSeeAll) return undefined

  if (user.roles.includes("client")) {
    return user.companyId ? eq(projects.companyId, user.companyId) : sql`1 = 0`
  }
  return user.agencyId ? eq(companies.referralAgencyId, user.agencyId) : sql`1 = 0`
}
