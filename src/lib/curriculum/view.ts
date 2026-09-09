/**
 * F-01 の選択状態（01_要件定義.md 5.7）。
 *
 * 研修プログラム → 職種カテゴリ → コース → 開催パターン と絞り込み、
 * 選んだ1コースを開催パターンの日程に当てはめて見る画面。
 * どこを見ていたかを URL に持たせ、追加・編集・削除のあとも同じ場所へ戻す。
 */
export type CurriculumView = {
  program?: string
  category?: string
  /** コースだけは id。コース番号は研修プログラムの中でしか一意にならない */
  course?: string
  pattern?: string
}

const KEYS = ["program", "category", "course", "pattern"] as const

/** searchParams から選択状態だけを取り出す。 */
export const pickView = (
  params: Partial<Record<string, string | string[] | undefined>>,
): CurriculumView => {
  const view: CurriculumView = {}
  for (const key of KEYS) {
    const value = params[key]
    if (typeof value === "string" && value !== "") view[key] = value
  }
  return view
}

/**
 * 選択状態を保った URL。
 * `extra` で通知や選択の切り替えを重ねる。undefined を渡した項目は落とす。
 */
export const curriculumHref = (
  view: CurriculumView,
  extra: Record<string, string | number | undefined> = {},
) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...view, ...extra })) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `/curriculum?${query}` : "/curriculum"
}
