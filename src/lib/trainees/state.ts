/**
 * 受講者フォームの入力値。
 * 区分値も文字列で持つ。検証前の生の入力をそのまま扱うため。
 */
export type TraineeValues = {
  name: string
  nameKana: string
  insuranceNumber: string
  employmentType: string
  jobType: string
  jobDescription: string
  gender: string
}

/**
 * 受講者の登録・編集の結果。
 *
 * actions.ts は "use server" のため async 関数しか export できない。
 * 型と定数はここに置く（src/lib/auth/form-state.ts と同じ理由）。
 */
export type TraineeFormState = {
  errors: string[]
  fieldErrors?: Record<string, string[]>
  /** エラー時に入力内容を復元するための送信値（React 19 のフォームリセット対策） */
  values?: TraineeValues
  /** 送信のたびに増える。フォームの key に使う */
  attempt?: number
}

export const EMPTY_TRAINEE_STATE: TraineeFormState = { errors: [] }
