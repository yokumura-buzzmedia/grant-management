/** サーバーアクションの結果。"use server" のファイルは async 関数しか export できないため分離する。 */
export type FormState = {
  /** 画面上部にまとめて表示するエラー */
  errors: string[]
  /** 入力欄ごとのエラー。項目数が多いフォームで使う */
  fieldErrors?: Record<string, string[]>
}

export const EMPTY_STATE: FormState = { errors: [] }
