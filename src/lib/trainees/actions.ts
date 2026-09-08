"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { EMPLOYMENT_TYPES, GENDERS, trainees, type EmploymentType, type Gender } from "@/db/schema"
import { requireCompanyEditor } from "@/lib/companies/authorize"
import { now } from "@/lib/datetime"
import type { TraineeFormState, TraineeValues } from "./state"

/**
 * D-03 受講者の登録・編集・削除（5.6）。
 *
 * 受講者は会社に紐づく。編集できるのはクライアント（自社分）・事務員・システム管理者で、
 * 判定は会社情報と同じ requireCompanyEditor に寄せる。
 * サーバーアクションの引数はクライアントから任意の値を渡せるため、
 * 画面を出し分けるだけでは足りず、ここでも会社IDと受講者の所属を突き合わせる。
 */

/** 全角カタカナ・長音・中黒・スペース。姓名の区切りにスペースを使う人がいる */
const KANA = /^[ァ-ヶー・　 ]+$/

const DUPLICATE_INSURANCE_NUMBER = "この雇用保険被保険者番号は、この会社に既に登録されています。"

const readValues = (formData: FormData): TraineeValues => ({
  name: String(formData.get("name") ?? "").trim(),
  nameKana: String(formData.get("nameKana") ?? "").trim(),
  insuranceNumber: String(formData.get("insuranceNumber") ?? "").trim(),
  employmentType: String(formData.get("employmentType") ?? ""),
  jobType: String(formData.get("jobType") ?? "").trim(),
  jobDescription: String(formData.get("jobDescription") ?? "").trim(),
  gender: String(formData.get("gender") ?? ""),
})

/** 7項目すべて必須（5.6）。 */
const validate = (values: TraineeValues) => {
  const fieldErrors: Record<string, string[]> = {}

  if (values.name === "") fieldErrors.name = ["氏名を入力してください。"]
  else if (values.name.length > 100) fieldErrors.name = ["氏名は100文字以内で入力してください。"]

  if (values.nameKana === "") fieldErrors.nameKana = ["フリガナを入力してください。"]
  else if (values.nameKana.length > 100)
    fieldErrors.nameKana = ["フリガナは100文字以内で入力してください。"]
  else if (!KANA.test(values.nameKana))
    fieldErrors.nameKana = ["フリガナは全角カタカナで入力してください。"]

  if (!/^\d{11}$/.test(values.insuranceNumber))
    fieldErrors.insuranceNumber = ["雇用保険被保険者番号は、ハイフンなしの半角数字11桁で入力してください。"]

  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(values.employmentType))
    fieldErrors.employmentType = ["雇用形態を選んでください。"]

  if (values.jobType === "") fieldErrors.jobType = ["職種を入力してください。"]
  else if (values.jobType.length > 100)
    fieldErrors.jobType = ["職種は100文字以内で入力してください。"]

  if (values.jobDescription === "") fieldErrors.jobDescription = ["職務内容を入力してください。"]
  else if (values.jobDescription.length > 255)
    fieldErrors.jobDescription = ["職務内容は255文字以内で入力してください。"]

  if (!(GENDERS as readonly string[]).includes(values.gender))
    fieldErrors.gender = ["性別を選んでください。"]

  return fieldErrors
}

const failure = (
  prev: TraineeFormState,
  values: TraineeValues,
  fieldErrors: Record<string, string[]>,
): TraineeFormState => ({
  errors: [],
  fieldErrors,
  values,
  attempt: (prev.attempt ?? 0) + 1,
})

/**
 * 一意制約違反か。
 * drizzle は元の mysql2 のエラーを DrizzleQueryError で包むため、
 * 一番外側だけを見ると code を取り逃がす。cause をたどって判定する。
 */
const isDuplicate = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  if ("code" in error && error.code === "ER_DUP_ENTRY") return true
  return isDuplicate(error.cause)
}

/** 保存後は会社詳細の受講者タブへ戻す。URL はIDから組み立て、クライアントからは受け取らない */
const backToCompany = (companyId: number, notice: string): never => {
  revalidatePath(`/companies/${companyId}`)
  return redirect(`/companies/${companyId}?tab=trainees&notice=trainee-${notice}`)
}

export async function createTraineeAction(
  companyId: number,
  prev: TraineeFormState,
  formData: FormData,
): Promise<TraineeFormState> {
  const actor = await requireCompanyEditor(companyId)

  const values = readValues(formData)
  const fieldErrors = validate(values)
  if (Object.keys(fieldErrors).length > 0) return failure(prev, values, fieldErrors)

  const current = now()
  try {
    await db.insert(trainees).values({
      companyId,
      name: values.name,
      nameKana: values.nameKana,
      insuranceNumber: values.insuranceNumber,
      employmentType: values.employmentType as EmploymentType,
      jobType: values.jobType,
      jobDescription: values.jobDescription,
      gender: values.gender as Gender,
      createdAt: current,
      createdBy: actor.id,
      updatedAt: current,
      updatedBy: actor.id,
    })
  } catch (error) {
    // 同じ会社の中では被保険者番号を重複させない（5.6）。判定は一意制約に任せる
    if (isDuplicate(error))
      return failure(prev, values, { insuranceNumber: [DUPLICATE_INSURANCE_NUMBER] })
    throw error
  }

  return backToCompany(companyId, "created")
}

export async function updateTraineeAction(
  traineeId: number,
  companyId: number,
  prev: TraineeFormState,
  formData: FormData,
): Promise<TraineeFormState> {
  const actor = await requireCompanyEditor(companyId)

  const [target] = await db
    .select({ id: trainees.id })
    .from(trainees)
    .where(and(eq(trainees.id, traineeId), eq(trainees.companyId, companyId)))
    .limit(1)
  if (!target) return { errors: ["受講者が見つかりません。"] }

  const values = readValues(formData)
  const fieldErrors = validate(values)
  if (Object.keys(fieldErrors).length > 0) return failure(prev, values, fieldErrors)

  try {
    await db
      .update(trainees)
      .set({
        name: values.name,
        nameKana: values.nameKana,
        insuranceNumber: values.insuranceNumber,
        employmentType: values.employmentType as EmploymentType,
        jobType: values.jobType,
        jobDescription: values.jobDescription,
        gender: values.gender as Gender,
        updatedAt: now(),
        updatedBy: actor.id,
      })
      .where(eq(trainees.id, target.id))
  } catch (error) {
    if (isDuplicate(error))
      return failure(prev, values, { insuranceNumber: [DUPLICATE_INSURANCE_NUMBER] })
    throw error
  }

  return backToCompany(companyId, "saved")
}

/**
 * 受講者の削除（5.6）。
 *
 * 削除履歴には記録しない。deletion_logs は会社・アカウント・申請案件だけを対象とする。
 * 参照テーブル（チーム所属・出欠記録・雇用契約書）は CASCADE で消え、
 * 過去記録にも名前を残さない（アカウントとは逆の方針）。
 */
export async function deleteTraineeAction(traineeId: number, companyId: number) {
  await requireCompanyEditor(companyId)

  await db
    .delete(trainees)
    .where(and(eq(trainees.id, traineeId), eq(trainees.companyId, companyId)))

  backToCompany(companyId, "deleted")
}
