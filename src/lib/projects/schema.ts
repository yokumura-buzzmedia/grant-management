import { z } from "zod"

/** C-09 申請案件の作成（01_要件定義.md 5.15, 5.16）。 */
export const projectSchema = z.object({
  companyId: z.coerce
    .number({ invalid_type_error: "会社を選択してください。" })
    .int()
    .positive("会社を選択してください。"),
  name: z
    .string()
    .trim()
    .min(1, "案件名を入力してください。")
    .max(255, "案件名は255文字以内で入力してください。"),
  /** 主担当の事務員は作成時に必ず1人設定する（5.16） */
  primaryStaffId: z.coerce
    .number({ invalid_type_error: "主担当の事務員を選択してください。" })
    .int()
    .positive("主担当の事務員を選択してください。"),
})

/**
 * C-02 基本情報の編集（5.16）。
 * 案件番号は自動発行、会社はコースの所属と同じく登録後に変えない。
 */
export const projectEditSchema = projectSchema.omit({ companyId: true })
