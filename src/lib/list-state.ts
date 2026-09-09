/**
 * 一覧の絞り込み状態を詳細画面へ持ち回り、戻りリンクで復元する。
 *
 * 検索して開いた会社から一覧へ戻ったときに、検索し直しにならないようにする。
 *
 * 呼び出し側から URL 文字列そのものを受け取ると、外部サイトへの誘導に使えてしまう。
 * 既知のキーと値だけを取り出して組み直す（`accounts/return-path.ts` と同じ理由）。
 */

/** 一覧が使う検索パラメータ。会社一覧とアカウント一覧の和集合。 */
const KEYS = ["q", "sort", "dir", "page", "kind", "role", "active"] as const

type Key = (typeof KEYS)[number]

export type ListState = Partial<Record<Key, string>>

/** searchParams から既知のキーだけを取り出す。 */
export const pickListState = (
  params: Partial<Record<string, string | string[] | undefined>>,
): ListState => {
  const state: ListState = {}
  for (const key of KEYS) {
    const value = params[key]
    if (typeof value === "string" && value !== "") state[key] = value
  }
  return state
}

/**
 * 詳細画面へ渡すクエリ文字列。空なら空文字を返す。
 *
 * URLSearchParams に undefined をそのまま渡すと "undefined" という文字列になるため、
 * 値のないキーはここで落とす。
 */
export const listStateQuery = (state: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === "string" && value !== "") search.set(key, value)
  }
  return search.toString()
}

/**
 * 一覧へ戻るリンク。`path` は呼び出し側が固定値で渡す。
 * 状態が空のときは素のパスを返し、余計なクエリを付けない。
 */
export const listHref = (path: string, state: ListState) => {
  const query = listStateQuery(state)
  return query ? `${path}?${query}` : path
}

/**
 * 詳細画面のURL。通知などを併せて付ける。
 * 保存後のリダイレクト先に使い、戻りリンクの復元が保存で切れないようにする。
 */
export const detailHref = (
  path: string,
  state: ListState,
  extra: Record<string, string> = {},
) => {
  const query = listStateQuery({ ...extra, ...pickListState(state) })
  return query ? `${path}?${query}` : path
}
