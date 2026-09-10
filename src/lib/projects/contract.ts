"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, contracts, projects } from "@/db/schema"
import type { FormState } from "@/lib/auth/form-state"
import { requireRoles } from "@/lib/auth/guards"
import { now } from "@/lib/datetime"
import { FreeeSignError, sendContract } from "@/lib/freee-sign"

/** 契約書を送れるのは事務員とシステム管理者だけ（06_画面設計.md 権限マトリクス C-04）。 */
const EDITORS = ["staff", "admin"] as const

/**
 * C-04 契約書の送付（01_要件定義.md 5.8 / 05_外部連携仕様.md 3.6）。
 *
 * 送付先は会社情報の担当者メールアドレス。ログインアカウントのメールアドレスではない。
 * 署名依頼メールは freeeサインから送られるため、本システムからは何も送らない。
 *
 * **申請案件のステータスは自動で進めない。** 送付後に事務員が手動で「4 契約書送付済」
 * へ進める（5.1）。送付と記録を分けるのは要件どおりで、送っただけで進むと
 * 送付の失敗に気づけない。
 */
export async function sendContractAction(
  projectId: number,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const actor = await requireRoles(EDITORS)

  const [row] = await db
    .select({
      id: projects.id,
      projectNumber: projects.projectNumber,
      name: projects.name,
      companyName: companies.name,
      contactEmail: companies.contactEmail,
    })
    .from(projects)
    .innerJoin(companies, eq(companies.id, projects.companyId))
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!row) redirect("/projects")

  const failed = (message: string): FormState => ({ errors: [message] })

  // 会社情報は一時保存できるため、担当者メールアドレスが未入力のことがある（5.3）
  if (!row.contactEmail) {
    return failed(
      "会社情報の担当者メールアドレスが未入力です。会社詳細で入力してから送付してください。",
    )
  }

  const [existing] = await db
    .select({
      id: contracts.id,
      sentAt: contracts.sentAt,
      canceledAt: contracts.canceledAt,
      concludedAt: contracts.concludedAt,
    })
    .from(contracts)
    .where(eq(contracts.projectId, row.id))
    .limit(1)

  // 締結済みは再送できない（5.8）。取消済みは送り直せるので通す
  if (existing?.concludedAt) return failed("締結済みの契約書は送付できません。")
  if (existing?.sentAt && !existing.canceledAt) {
    return failed("すでに送付済みです。送り直すには、先に送付を取り消してください。")
  }

  let result: Awaited<ReturnType<typeof sendContract>>
  try {
    result = await sendContract({
      title: `${row.projectNumber} ${row.companyName} 契約書`,
      email: row.contactEmail,
    })
  } catch (error) {
    // 相手側の都合で失敗するので、握りつぶさずそのまま画面へ出す（5.22 / 3.13）
    if (error instanceof FreeeSignError) return failed(error.message)
    throw error
  }

  const at = now()
  if (existing) {
    await db
      .update(contracts)
      .set({
        freeeSignDocumentId: result.documentId,
        sentAt: at,
        // 送り直しなので、前回の取消を消す
        canceledAt: null,
        updatedAt: at,
        updatedBy: actor.id,
      })
      .where(eq(contracts.id, existing.id))
  } else {
    await db.insert(contracts).values({
      projectId: row.id,
      freeeSignDocumentId: result.documentId,
      // 送付した事実だけを記録する。文書の状態はポーリングで取り込む（3.9・未実装）
      sentAt: at,
      createdAt: at,
      createdBy: actor.id,
      updatedAt: at,
      updatedBy: actor.id,
    })
  }

  revalidatePath(`/projects/${row.id}`)
  redirect(`/projects/${row.id}?notice=contractSent`)
}
