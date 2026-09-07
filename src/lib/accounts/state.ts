/**
 * アカウント作成の結果。
 * 仮パスワードは URL に載せず、この状態で一度だけ返す。
 */
export type AccountFormState = {
  errors: string[]
  fieldErrors?: Record<string, string[]>
  /** エラー時に入力内容を復元するための送信値（React 19 のフォームリセット対策） */
  values?: Record<string, string | string[]>
  /** 送信のたびに増える。フォームの key に使う */
  attempt?: number
  created?: { loginId: string; displayName: string; temporaryPassword: string }
}

export const EMPTY_ACCOUNT_STATE: AccountFormState = { errors: [] }
