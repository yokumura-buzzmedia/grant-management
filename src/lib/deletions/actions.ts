"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, deletionLogs, users } from "@/db/schema"
import { canManage, countActiveAdmins, findAccount } from "@/lib/accounts/authorize"
import { requireRoles } from "@/lib/auth/guards"
import { clearSessionCookie } from "@/lib/auth/session"
import { now } from "@/lib/datetime"

/**
 * 会社とアカウントの完全削除（01_要件定義.md 5.3, 5.4）。
 *
 * すべて物理削除で、復元できない。削除理由は求めない。
 * 本体は消えるため、必要な値を deletion_logs に複製して残す（04_DB論理設計.md 2.4）。
 * deletion_logs の行は削除できない（削除機能を設けない）。
 */
const DELETERS = ["staff", "admin"] as const

/**
 * 会社の完全削除（5.3）。
 * 紐づく申請案件・クライアントアカウント・受講者も外部キーの連鎖で削除される。
 */
export async function deleteCompanyAction(companyId: number) {
  const actor = await requireRoles(DELETERS)

  const [company] = await db
    .select({ id: companies.id, name: companies.name, corporateNumber: companies.corporateNumber })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
  if (!company) redirect("/companies")

  await db.transaction(async (tx) => {
    await tx.insert(deletionLogs).values({
      targetType: "company",
      deletedBy: actor.id,
      deletedByName: actor.displayName,
      deletedAt: now(),
      detail: { companyName: company.name, corporateNumber: company.corporateNumber },
    })
    await tx.delete(companies).where(eq(companies.id, company.id))
  })

  revalidatePath("/companies")
  revalidatePath("/accounts")
  redirect("/companies?notice=deleted")
}

/**
 * アカウントの完全削除（5.4）。
 *
 * - 事務員はシステム管理者権限のアカウントを削除できない
 * - 有効なシステム管理者が1人だけの場合、そのアカウントは削除できない
 * - システム管理者は自分自身を削除できる。その場合はログイン画面へ戻す
 * - クライアントアカウントを削除しても、所属会社や業務データは残す
 */
export async function deleteAccountAction(targetId: number) {
  const actor = await requireRoles(DELETERS)

  const target = await findAccount(targetId)
  if (!target) redirect("/accounts")
  if (!canManage(actor.roles, target)) redirect(`/accounts/${targetId}?error=forbidden`)

  if (
    target.roles.includes("admin") &&
    target.isActive &&
    (await countActiveAdmins(target.id)) === 0
  ) {
    redirect(`/accounts/${targetId}?error=lastAdmin`)
  }

  await db.transaction(async (tx) => {
    await tx.insert(deletionLogs).values({
      targetType: "user",
      deletedBy: actor.id,
      deletedByName: actor.displayName,
      deletedAt: now(),
      detail: { displayName: target.displayName, loginId: target.loginId },
    })
    // 削除した利用者を deleted_by に持つ行は SET NULL になる。名前はスナップショットで残る
    await tx.delete(users).where(eq(users.id, target.id))
  })

  revalidatePath("/accounts")
  revalidatePath("/deletion-logs")

  // 自分自身を削除した場合はセッションも連鎖削除されている
  if (target.id === actor.id) {
    await clearSessionCookie()
    redirect("/login?notice=self-deleted")
  }
  redirect("/accounts?notice=deleted")
}
