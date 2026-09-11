import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { contracts, projects, type ProjectStatus } from "@/db/schema"
import { now } from "@/lib/datetime"
import { type DocumentState, fetchDocumentPdf, FreeeSignError } from "@/lib/freee-sign"
import { putObject } from "@/lib/storage"
import { nextStatus } from "./status"

/**
 * freeeサインの文書の状態を、本システムへ反映する（05_外部連携仕様.md 3.9, 3.10, 3.11）。
 *
 * 事務員の「最新状態を取得」と、10分間隔のポーリングの両方から使う。
 * 更新の規則を2か所に写すと、片方だけ直したときに画面とバッチで挙動が割れる。
 */

export type SyncTarget = {
  contractId: number
  projectId: number
  projectStatus: ProjectStatus
  freeeSignDocumentId: number
  concludedAt: Date | null
  pdfFileKey: string | null
}

export type SyncOutcome = {
  status: DocumentState["status"]
  /** 申請案件を「5 契約締結済」へ進めたか */
  advanced: boolean
  /** 締結済みPDFを新しく保管したか */
  storedPdf: boolean
}

/**
 * 1件ぶんの反映。
 *
 * `actorId` は操作した利用者。ポーリングのような自動処理では null を渡し、
 * 最終更新者を「システム」として扱う（5.17）。
 */
export const applyDocumentState = async (
  target: SyncTarget,
  document: DocumentState,
  actorId: number | null,
): Promise<SyncOutcome> => {
  /*
   * 締結済みPDFだけを手元に残す（3.10）。未署名は都度取りに行くので保存しない。
   * 保存するのは `timestamped` が true のものだけ。false の間は PDF が未完成で、
   * 取りに行ってもエラーになる。pdf_file_key が NULL のままなら次の取得でやり直せる。
   *
   * 取得に失敗しても状態の記録は残したいので、ここでは例外を外へ出さない。
   */
  let pdfFileKey = target.pdfFileKey
  if (!pdfFileKey && document.status === "concluded" && document.timestamped) {
    try {
      const pdf = await fetchDocumentPdf(target.freeeSignDocumentId)
      const key = `contracts/${target.projectId}/${randomUUID()}.pdf`
      await putObject(key, pdf, "application/pdf")
      pdfFileKey = key
    } catch (error) {
      if (!(error instanceof FreeeSignError)) throw error
    }
  }
  const storedPdf = Boolean(pdfFileKey) && !target.pdfFileKey

  await db
    .update(contracts)
    .set({
      freeeSignStatus: document.status,
      pdfFileKey,
      pdfFetchedAt: storedPdf ? now() : undefined,
      /*
       * 締結日時は freeeサインが持っている値を使う。返らない場合に限り、
       * 締結を最初に確認できた時点で埋める。一度入ったら上書きしない。
       * 取り直すたびに現在時刻を入れると、いつ締結したのかが分からなくなる。
       */
      concludedAt:
        target.concludedAt ??
        document.concludedAt ??
        (document.status === "concluded" ? now() : null),
      updatedAt: now(),
    })
    .where(eq(contracts.id, target.contractId))

  // 締結を確認できたときだけ進める。順序を飛ばさないため、現在が4のときに限る（5.1）
  const advanced =
    document.status === "concluded" && nextStatus(target.projectStatus) === "contract_concluded"
  if (advanced) {
    await db
      .update(projects)
      .set({ status: "contract_concluded", updatedAt: now(), updatedBy: actorId })
      .where(eq(projects.id, target.projectId))
  }

  return { status: document.status, advanced, storedPdf }
}
