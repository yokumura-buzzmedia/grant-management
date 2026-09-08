import type { EmploymentType, Gender } from "@/db/schema"

/** 雇用形態の表示名（01_要件定義.md 5.6）。クライアントコンポーネントでも使う。 */
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "正社員",
  contract: "契約社員",
  part_time: "パート・アルバイト",
  dispatched: "派遣",
  other: "その他",
}

/** 性別の表示名（01_要件定義.md 5.6）。 */
export const GENDER_LABELS: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
}
