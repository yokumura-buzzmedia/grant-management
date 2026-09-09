"use server"

import { redirect } from "next/navigation"
import { detailHref, type ListState } from "@/lib/list-state"
import { revalidatePath } from "next/cache"
import { and, eq, ne } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import type { FormState } from "@/lib/auth/form-state"
import { requireRoles } from "@/lib/auth/guards"
import { requireCompanyEditor } from "@/lib/companies/authorize"
import { now } from "@/lib/datetime"
import { companySchema } from "./schema"

/** 会社を新しく作れるのは事務員とシステム管理者だけ（06_画面設計.md 5 の D-01）。 */
const EDITORS = ["staff", "admin"] as const

/** 入力値をそのまま取り出す。エラー時の復元にも使う。 */
const rawValues = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  ) as Record<string, string>

const invalid = (
  prev: FormState,
  values: Record<string, string>,
  fieldErrors: Record<string, string[]>,
): FormState => ({
  errors: [],
  fieldErrors,
  values,
  attempt: (prev.attempt ?? 0) + 1,
})

/** 法人番号は重複を許さない（5.3）。一意制約と併せてアプリ側でも確認する。 */
const duplicateCorporateNumber = async (corporateNumber: string | null, excludeId?: number) => {
  if (!corporateNumber) return false
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      excludeId
        ? and(eq(companies.corporateNumber, corporateNumber), ne(companies.id, excludeId))
        : eq(companies.corporateNumber, corporateNumber),
    )
    .limit(1)
  return Boolean(row)
}

const DUPLICATE_MESSAGE = "この法人番号はすでに登録されています。"

export async function createCompanyAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = companySchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  if (await duplicateCorporateNumber(parsed.data.corporateNumber)) {
    return invalid(prev, values, { corporateNumber: [DUPLICATE_MESSAGE] })
  }

  const current = now()
  const [result] = await db.insert(companies).values({
    ...parsed.data,
    createdAt: current,
    createdBy: user.id,
    updatedAt: current,
    updatedBy: user.id,
  })

  revalidatePath("/companies")
  redirect(`/companies/${Number(result.insertId)}?notice=created`)
}

export async function updateCompanyAction(
  companyId: number,
  // 一覧から来たときの絞り込み状態。保存後も戻り先を保つために持ち回る。
  // サーバー側で bind した値なので、クライアントから差し替えられない
  listState: ListState,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // クライアントは自社だけ編集できる（06_画面設計.md 5 の ○）。他社のIDを渡されても通さない
  const user = await requireCompanyEditor(companyId)
  const values = rawValues(formData)
  const parsed = companySchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  if (await duplicateCorporateNumber(parsed.data.corporateNumber, companyId)) {
    return invalid(prev, values, { corporateNumber: [DUPLICATE_MESSAGE] })
  }

  await db
    .update(companies)
    .set({ ...parsed.data, updatedAt: now(), updatedBy: user.id })
    .where(eq(companies.id, companyId))

  revalidatePath("/companies")
  redirect(detailHref(`/companies/${companyId}`, listState, { notice: "saved" }))
}
