import { z } from "zod"
import { COMPANY_TYPES, type CompanyType } from "@/db/schema"

/**
 * 会社情報の入力条件（01_要件定義.md 5.3）。
 *
 * 最終的には全項目が必須だが、一時保存を可能にするため会社名以外は未入力を許す。
 * 必須の判定は「契約書送付」へ進める時点で行う（申請案件の実装時）。
 */

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  corporation: "株式会社",
  llc: "合同会社",
  lp: "合資会社",
  general_partnership: "合名会社",
  sole_proprietor: "個人事業主",
  other: "その他",
}

export const COMPANY_TYPE_OPTIONS = COMPANY_TYPES.map((value) => ({
  value,
  label: COMPANY_TYPE_LABELS[value],
}))

/** 空文字は未入力として null に倒す。前後の空白は落とす。 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value ?? null
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }, schema.nullable())

const wholeNumber = (label: string) =>
  optional(
    z.coerce
      .number({ invalid_type_error: `${label}は半角数字で入力してください。` })
      .int(`${label}は整数で入力してください。`)
      .min(0, `${label}は0以上で入力してください。`),
  )

export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "会社名を入力してください。")
    .max(255, "会社名は255文字以内で入力してください。"),
  corporateNumber: optional(
    z.string().regex(/^\d{13}$/, "法人番号は半角数字13桁で入力してください。"),
  ),
  representativeName: optional(z.string().max(100, "代表者名は100文字以内で入力してください。")),
  industry: optional(z.string().max(100, "業種は100文字以内で入力してください。")),
  companyType: optional(z.enum(COMPANY_TYPES)),
  employeeCount: wholeNumber("従業員数"),
  capital: wholeNumber("資本金"),
  postalCode: optional(
    z.string().regex(/^\d{7}$/, "郵便番号はハイフンなしの半角数字7桁で入力してください。"),
  ),
  address: optional(z.string().max(255, "住所は255文字以内で入力してください。")),
  buildingName: optional(z.string().max(255, "建物名は255文字以内で入力してください。")),
  phone: optional(
    z
      .string()
      .refine(
        (value) => /^[0-9-]+$/.test(value) && [10, 11].includes(value.replace(/-/g, "").length),
        "電話番号は数字10桁または11桁で入力してください（ハイフンは任意）。",
      ),
  ),
  contactName: optional(z.string().max(100, "担当者名は100文字以内で入力してください。")),
  contactEmail: optional(
    z
      .string()
      .email("担当者メールアドレスの形式が正しくありません。")
      .max(255, "担当者メールアドレスは255文字以内で入力してください。"),
  ),
})

export type CompanyInput = z.output<typeof companySchema>
