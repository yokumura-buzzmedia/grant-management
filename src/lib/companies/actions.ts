"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { and, eq, ne } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import type { FormState } from "@/lib/auth/form-state"
import { requireRoles } from "@/lib/auth/guards"
import { now } from "@/lib/datetime"
import { companySchema } from "./schema"

/** D-01・D-02 を操作できるのは事務員とシステム管理者（06_画面設計.md 5）。 */
const EDITORS = ["staff", "admin"] as const

const parse = (formData: FormData) => {
  const values = Object.fromEntries(formData.entries())
  return companySchema.safeParse(values)
}

const toFieldErrors = (error: import("zod").ZodError): FormState => ({
  errors: [],
  fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
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
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRoles(EDITORS)
  const parsed = parse(formData)
  if (!parsed.success) return toFieldErrors(parsed.error)

  if (await duplicateCorporateNumber(parsed.data.corporateNumber)) {
    return { errors: [], fieldErrors: { corporateNumber: [DUPLICATE_MESSAGE] } }
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
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRoles(EDITORS)
  const parsed = parse(formData)
  if (!parsed.success) return toFieldErrors(parsed.error)

  if (await duplicateCorporateNumber(parsed.data.corporateNumber, companyId)) {
    return { errors: [], fieldErrors: { corporateNumber: [DUPLICATE_MESSAGE] } }
  }

  await db
    .update(companies)
    .set({ ...parsed.data, updatedAt: now(), updatedBy: user.id })
    .where(eq(companies.id, companyId))

  revalidatePath("/companies")
  redirect(`/companies/${companyId}?notice=saved`)
}
