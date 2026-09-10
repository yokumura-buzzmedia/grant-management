import { z } from "zod"
import { COURSE_TOTAL_HOURS } from "./masters"

/**
 * カリキュラムマスタの入力条件（01_要件定義.md 5.7）。
 *
 * 各マスタのコードは登録後に変更しない。編集用のスキーマはコードを外してあり、
 * 画面でも読み取り専用で見せる。
 */

const code = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}を入力してください。`)
    .max(32, `${label}は32文字以内で入力してください。`)
    .regex(/^[A-Za-z0-9_-]+$/, `${label}は半角英数字・ハイフン・アンダースコアで入力してください。`)

const name = (label: string, max = 255) =>
  z
    .string()
    .trim()
    .min(1, `${label}を入力してください。`)
    .max(max, `${label}は${max}文字以内で入力してください。`)

const order = z.coerce
  .number({ invalid_type_error: "表示順は半角数字で入力してください。" })
  .int("表示順は整数で入力してください。")
  .min(0, "表示順は0以上で入力してください。")

/** 空文字は未入力として null に倒す。 */
const optionalText = (label: string, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value ?? null
      const trimmed = value.trim()
      return trimmed === "" ? null : trimmed
    },
    z.string().max(max, `${label}は${max}文字以内で入力してください。`).nullable(),
  )

// ---------------------------------------------------------------------------

export const programSchema = z.object({
  code: code("研修プログラムコード"),
  name: name("研修プログラム名"),
  stage: name("段階", 32),
  displayOrder: order,
})

export const programEditSchema = programSchema.omit({ code: true })

export const categorySchema = z.object({
  code: code("職種カテゴリコード"),
  name: name("職種カテゴリ名"),
  displayOrder: order,
})

export const categoryEditSchema = categorySchema.omit({ code: true })

export const courseSchema = z.object({
  programCode: code("研修プログラムコード"),
  categoryCode: code("職種カテゴリコード"),
  courseNumber: z
    .string()
    .trim()
    .min(1, "コース番号を入力してください。")
    .max(8, "コース番号は8文字以内で入力してください。")
    .regex(/^[A-Za-z0-9-]+$/, "コース番号は半角英数字とハイフンで入力してください。"),
  jobName: name("職種名"),
  purpose: z.string().trim().min(1, "目的を入力してください。"),
  displayOrder: order,
})

/** 研修プログラムとコース番号はコースの識別子。登録後は変更しない */
export const courseEditSchema = courseSchema.omit({ programCode: true, courseNumber: true })

export const sessionSchema = z.object({
  sessionSymbol: z
    .string()
    .trim()
    .min(1, "コマ記号を入力してください。")
    .max(16, "コマ記号は16文字以内で入力してください。"),
  displayOrder: order,
  durationHours: z.coerce
    .number({ invalid_type_error: "所要時間は半角数字で入力してください。" })
    .gt(0, "所要時間は0より大きい値で入力してください。")
    .max(COURSE_TOTAL_HOURS, `所要時間は${COURSE_TOTAL_HOURS}時間以内で入力してください。`)
    .refine((value) => (value * 2) % 1 === 0, "所要時間は0.5時間単位で入力してください。"),
  title: name("タイトル"),
  description: optionalText("説明", 1000),
})

/**
 * コマ記号は開催パターンの日別割当と対応する。登録後は変更しない。
 * 表示順は日程のカードをドラッグして決めるので、フォームからは受け取らない。
 */
export const sessionEditSchema = sessionSchema.omit({ sessionSymbol: true, displayOrder: true })

export const patternSchema = z.object({
  code: code("開催パターンコード"),
  name: name("開催パターン名"),
  days: z.coerce
    .number({ invalid_type_error: "受講日数は半角数字で入力してください。" })
    .int("受講日数は整数で入力してください。")
    .min(2, "受講日数は2〜5で入力してください。")
    .max(5, "受講日数は2〜5で入力してください。"),
  timeBreakdown: name("時間内訳"),
  displayOrder: order,
})

export const patternEditSchema = patternSchema.omit({ code: true })
