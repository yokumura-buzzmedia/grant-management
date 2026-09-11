"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, contracts, projects } from "@/db/schema"
import type { FormState } from "@/lib/auth/form-state"
import { requireRoles } from "@/lib/auth/guards"
import { now } from "@/lib/datetime"
import { fetchDocument, FreeeSignError, sendContract } from "@/lib/freee-sign"
import { applyDocumentState } from "./contract-sync"
import { nextStatus } from "./status"

/** 契約書を送れるのは事務員とシステム管理者だけ（06_画面設計.md 権限マトリクス C-04）。 */
const EDITORS = ["staff", "admin"] as const

/**
 * C-04 契約書の送付（01_要件定義.md 5.8 / 05_外部連携仕様.md 3.6）。
 *
 * 送付先は会社情報の担当者メールアドレス。ログインアカウントのメールアドレスではない。
 * 署名依頼メールは freeeサインから送られるため、本システムからは何も送らない。
 *
 * **送付に成功したら「4 契約書送付済」へ自動で進める。**
 * 要件5.1 の「ステータスの自動変更は行わない」に対する例外で、運用の判断による。
 * 進めるのは現在が「3 助成金説明済」のときだけ。順序どおりにしか進まない決まりは
 * 変えないので、それ以外のステータスからは送付だけ行い、ステータスは動かさない。
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
      status: projects.status,
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
  // 送付できたときだけ進める。順序を飛ばさないため、現在が3のときに限る（5.1）
  const advanced = nextStatus(row.status) === "contract_sent"
  if (advanced) {
    await db
      .update(projects)
      .set({ status: "contract_sent", updatedAt: at, updatedBy: actor.id })
      .where(eq(projects.id, row.id))
  }

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
  revalidatePath("/projects")
  // 操作した契約書タブへ戻す。既定のタブへ落ちると結果が見えない
  redirect(
    `/projects/${row.id}?tab=contract&notice=${advanced ? "contractSentAdvanced" : "contractSent"}`,
  )
}

/**
 * 送付した契約書の状態を取り直す（05_外部連携仕様.md 3.11）。
 *
 * 締結の検知は本来ポーリング（3.9）で行うが未実装のため、いまは事務員が
 * この操作で1件ずつ取り直す。事務員の操作に対する応答なので同期処理にする（5.22）。
 *
 * **締結を確認できたら「5 契約締結済」へ自動で進める**（5.1 の例外）。
 * 進めるのは現在が「4 契約書送付済」のときだけで、順序は飛ばさない。
 * 却下・有効期限切れは記録だけ行い、前へは戻さない（3.9）。
 */
export async function syncContractAction(projectId: number): Promise<FormState> {
  const actor = await requireRoles(EDITORS)

  const [target] = await db
    .select({
      contractId: contracts.id,
      projectId: projects.id,
      projectStatus: projects.status,
      freeeSignDocumentId: contracts.freeeSignDocumentId,
      concludedAt: contracts.concludedAt,
      pdfFileKey: contracts.pdfFileKey,
    })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(eq(contracts.projectId, projectId))
    .limit(1)
  if (!target?.freeeSignDocumentId) {
    return { errors: ["まだ契約書を送付していません。"] }
  }

  let document: Awaited<ReturnType<typeof fetchDocument>>
  try {
    document = await fetchDocument(target.freeeSignDocumentId)
  } catch (error) {
    if (error instanceof FreeeSignError) return { errors: [error.message] }
    throw error
  }

  const outcome = await applyDocumentState(
    { ...target, freeeSignDocumentId: target.freeeSignDocumentId },
    document,
    actor.id,
  )

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/projects")
  redirect(
    `/projects/${projectId}?tab=contract&notice=${outcome.advanced ? "contractSyncedAdvanced" : "contractSynced"}`,
  )
}
