"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { employmentContracts, MAX_FILE_SIZE, trainees } from "@/db/schema"
import { canManageCompanies, requireCompanyEditor } from "@/lib/companies/authorize"
import { now } from "@/lib/datetime"
import { ALLOWED_CONTENT_TYPES, createUploadUrl, isAllowedContentType } from "@/lib/storage"
import { deleteObject } from "@/lib/storage/local"

/**
 * D-04 受講者ごとの雇用契約書（5.2）。
 *
 * 申請案件ではなく受講者（会社）に紐づく。承認は会社単位で一度だけ行い、
 * 同じ会社のすべての申請案件で承認済みとして扱う。
 * 承認済みを差し替えたら承認を取り消す。状態は行が1つしかないので、
 * この行を submitted に戻すだけで全案件に反映される。
 */

export type UploadTicket =
  | { ok: true; key: string; url: string }
  | { ok: false; error: string }

/** 受講者がその会社のものであることを確かめる。引数はクライアントから任意の値が渡る */
const requireTrainee = async (traineeId: number, companyId: number) => {
  const user = await requireCompanyEditor(companyId)
  const [trainee] = await db
    .select({ id: trainees.id })
    .from(trainees)
    .where(and(eq(trainees.id, traineeId), eq(trainees.companyId, companyId)))
    .limit(1)
  if (!trainee) redirect(`/companies/${companyId}?tab=trainees&error=contract-notFound`)
  return user
}

const backToTrainees = (companyId: number, notice: string): never => {
  revalidatePath(`/companies/${companyId}`)
  return redirect(`/companies/${companyId}?tab=trainees&notice=contract-${notice}`)
}

/**
 * アップロード先の発行。
 * 権限と形式・大きさをここで確かめ、通ったものにだけ署名を出す。
 */
export async function requestContractUploadAction(
  traineeId: number,
  companyId: number,
  contentType: string,
  size: number,
): Promise<UploadTicket> {
  await requireTrainee(traineeId, companyId)

  if (!isAllowedContentType(contentType)) {
    return { ok: false, error: "PDF・JPEG・PNG のいずれかを選んでください。" }
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE_SIZE) {
    return { ok: false, error: "ファイルは50MBまでです。" }
  }

  // 保存名は推測できない値にする。元のファイル名は列で持つ
  const key = `employment-contracts/${traineeId}/${randomUUID()}.${ALLOWED_CONTENT_TYPES[contentType]}`
  return { ok: true, key, url: createUploadUrl(key, contentType) }
}

/** アップロード済みのファイルを登録する。差し替えのときは前のファイルを消す（5.2） */
export async function submitContractAction(
  traineeId: number,
  companyId: number,
  file: { key: string; filename: string; contentType: string; size: number },
) {
  const actor = await requireTrainee(traineeId, companyId)

  if (!isAllowedContentType(file.contentType)) return
  if (!file.key.startsWith(`employment-contracts/${traineeId}/`)) return

  const current = now()
  const [existing] = await db
    .select({ id: employmentContracts.id, fileKey: employmentContracts.fileKey })
    .from(employmentContracts)
    .where(eq(employmentContracts.traineeId, traineeId))
    .limit(1)

  const values = {
    fileKey: file.key,
    originalFilename: file.filename.slice(0, 255),
    contentType: file.contentType,
    fileSize: file.size,
    status: "submitted" as const,
    submittedAt: current,
    // 差し替えたら承認を取り消す（5.2）
    approvedAt: null,
    approvedBy: null,
    updatedAt: current,
    updatedBy: actor.id,
  }

  if (existing) {
    await db
      .update(employmentContracts)
      .set(values)
      .where(eq(employmentContracts.id, existing.id))
    // 履歴は保持しない。DB を更新できてから消す
    if (existing.fileKey !== file.key) await deleteObject(existing.fileKey)
  } else {
    await db.insert(employmentContracts).values({
      traineeId,
      ...values,
      createdAt: current,
      createdBy: actor.id,
    })
  }

  backToTrainees(companyId, existing ? "replaced" : "submitted")
}

/** 承認は事務員とシステム管理者だけ（06_画面設計.md 5 の ◎ 承認）。 */
export async function approveContractAction(traineeId: number, companyId: number) {
  const actor = await requireTrainee(traineeId, companyId)
  if (!canManageCompanies(actor)) {
    redirect(`/companies/${companyId}?tab=trainees&error=contract-forbidden`)
  }

  const current = now()
  await db
    .update(employmentContracts)
    .set({
      status: "approved",
      approvedAt: current,
      approvedBy: actor.id,
      updatedAt: current,
      updatedBy: actor.id,
    })
    .where(eq(employmentContracts.traineeId, traineeId))

  backToTrainees(companyId, "approved")
}

/**
 * 雇用契約書の削除。
 *
 * 承認と同じく事務員とシステム管理者だけにする。間違えて出した分を直すだけなら
 * クライアントは差し替えで足りる。承認済みを消すと進行中の申請案件が
 * 再び先へ進めなくなるため（5.2）、その判断は事務員側に置く。
 *
 * 削除履歴には記録しない。deletion_logs は会社・アカウント・申請案件だけを対象とする。
 */
export async function deleteContractAction(traineeId: number, companyId: number) {
  const actor = await requireTrainee(traineeId, companyId)
  if (!canManageCompanies(actor)) {
    redirect(`/companies/${companyId}?tab=trainees&error=contract-forbidden`)
  }

  const [existing] = await db
    .select({ id: employmentContracts.id, fileKey: employmentContracts.fileKey })
    .from(employmentContracts)
    .where(eq(employmentContracts.traineeId, traineeId))
    .limit(1)
  if (existing) {
    await db.delete(employmentContracts).where(eq(employmentContracts.id, existing.id))
    // 行を消せてから実体を消す。逆にすると、失敗したときに参照だけが残る
    await deleteObject(existing.fileKey)
  }

  backToTrainees(companyId, "deleted")
}
