/** サーバーアクションの結果。"use server" のファイルは async 関数しか export できないため分離する。 */
export type FormState = { errors: string[] }

export const EMPTY_STATE: FormState = { errors: [] }
