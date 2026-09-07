/** サーバーアクションの結果。"use server" のファイルは async 関数しか export できないため分離する。 */
export type FormState = {
  /** 画面上部にまとめて表示するエラー */
  errors: string[]
  /** 入力欄ごとのエラー。項目数が多いフォームで使う */
  fieldErrors?: Record<string, string[]>
  /**
   * 送信された値。エラー時に入力内容を復元するために返す。
   *
   * React 19 は form action の完了後にフォームを初期値へ戻すため、
   * 何もしないと検証エラーのたびに入力が消える。
   */
  values?: Record<string, string | string[]>
  /** 送信のたびに増える。フォームの key に使い、復元した初期値を確実に反映させる */
  attempt?: number
}

export const EMPTY_STATE: FormState = { errors: [] }
