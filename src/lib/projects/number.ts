/**
 * 案件番号（01_要件定義.md 5.15）。
 *
 * 会社や年度で分けない通し番号。桁を揃えてゼロ埋めする。
 * project_number は varchar で、一覧の既定の並びが案件番号の降順のため、
 * 桁がそろっていないと "10" が "9" より前に並ぶ。
 *
 * 削除は物理削除なので、削除した番号は欠番になる。振り直しはしない。
 */
export const PROJECT_NUMBER_DIGITS = 9

export const formatProjectNumber = (value: number) =>
  String(value).padStart(PROJECT_NUMBER_DIGITS, "0")

/** 採番済みの最大値。1件もなければ0 */
export const parseProjectNumber = (value: string | null | undefined) => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}
