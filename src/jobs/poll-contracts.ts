/**
 * 契約書の締結を検知する（05_外部連携仕様.md 3.9）。
 *
 *   node --import tsx src/jobs/poll-contracts.ts
 *
 * EventBridge Scheduler から ECS の単発タスクとして10分間隔で起動する。
 * Webhook は使わない。freeeサインにサンドボックスが無く、送信先がテナント単位の
 * 設定なので、検証環境の操作が本番へ届く事故を防げないため（3.1）。
 *
 * **前回実行時刻を持たないステートレスな方式。** 下の抽出条件が「やるべき仕事」を
 * その都度定義するので、ジョブが落ちても次回に自然と復帰し、取りこぼしが
 * 構造的に起きない。
 *
 * 最終更新者は「システム」として残す（5.17）。操作した利用者がいないため。
 */
import { and, eq, isNotNull, isNull } from "drizzle-orm"
import { db, pool } from "@/db/client"
import { contracts, projects } from "@/db/schema"
import { fetchDocuments, freeeSignMode } from "@/lib/freee-sign"
import { applyDocumentState } from "@/lib/projects/contract-sync"

const main = async () => {
  // 未設定の環境では何もしない。mock は本物を呼ばないので、そのまま通して経路を確かめる
  const mode = freeeSignMode()
  if (mode === "unconfigured") {
    console.log("freeeサイン連携が設定されていません。何もしません。")
    return
  }
  if (mode === "mock") console.log("モードは mock です。freeeサインは呼びません。")

  /*
   * 送付済みで、取り消されておらず、締結済みPDFをまだ取得していないもの（3.9）。
   * PDFを取得できた時点で対象から外れる。締結済みでもPDFが未取得なら残り続け、
   * それが再試行として機能する（3.10）。
   */
  const targets = await db
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
    .where(
      and(
        isNotNull(contracts.sentAt),
        isNull(contracts.canceledAt),
        isNull(contracts.pdfFetchedAt),
        isNotNull(contracts.freeeSignDocumentId),
      ),
    )

  if (targets.length === 0) {
    console.log("対象の契約書はありません。")
    return
  }

  const documentIds = targets.flatMap((target) =>
    target.freeeSignDocumentId === null ? [] : [target.freeeSignDocumentId],
  )
  const documents = await fetchDocuments(documentIds)
  console.log(`対象 ${targets.length} 件、freeeサインから ${documents.size} 件の状態を取得しました。`)

  let advanced = 0
  let storedPdf = 0
  let missing = 0
  let failed = 0

  for (const target of targets) {
    const documentId = target.freeeSignDocumentId
    if (documentId === null) continue

    const document = documents.get(documentId)
    if (!document) {
      // freeeサイン側で削除された文書など。記録は変えず、次回も対象に残す
      missing += 1
      continue
    }

    /*
     * 1件の失敗で残りを止めない。相手側の都合で個別に落ちることがあり、
     * 次回のポーリングで拾い直せる。
     */
    try {
      const outcome = await applyDocumentState(
        { ...target, freeeSignDocumentId: documentId },
        document,
        null,
      )
      if (outcome.advanced) advanced += 1
      if (outcome.storedPdf) storedPdf += 1
    } catch (error) {
      failed += 1
      console.error(`契約書 ${target.contractId} の反映に失敗しました。`, error)
    }
  }

  console.log(
    `ステータスを進めた案件 ${advanced} 件、PDFを保管した契約書 ${storedPdf} 件、` +
      `freeeサインに見つからなかった文書 ${missing} 件、反映に失敗 ${failed} 件。`,
  )
}

main()
  .then(async () => {
    await pool.end()
  })
  .catch(async (error) => {
    console.error("契約書のポーリングに失敗しました。", error)
    await pool.end()
    // CloudWatch アラームで検知させるため、失敗は終了コードで示す（3.13）
    process.exit(1)
  })
