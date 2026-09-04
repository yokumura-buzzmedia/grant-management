/**
 * ログインIDとパスワードの入力条件（01_要件定義.md 5.4）。
 *
 * 条件はクライアントコンポーネントでも表示するため、
 * ネイティブモジュールに依存しないこのファイルに置く。
 */

/** 通常パスワードの条件。満たさない場合はその内容を画面に表示する。 */
export const PASSWORD_RULES = [
  { label: "8文字以上20文字以下", test: (v: string) => v.length >= 8 && v.length <= 20 },
  { label: "半角英数字と半角記号のみを使用する", test: (v: string) => /^[\x21-\x7e]*$/.test(v) },
  { label: "半角英字を1文字以上含む", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "半角数字を1文字以上含む", test: (v: string) => /[0-9]/.test(v) },
] as const

/** 満たしていない条件を返す。空配列なら条件を満たしている。 */
export const validatePassword = (password: string): string[] =>
  PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label)

/** ログインIDは半角英数字と「-」「_」で6〜20文字。大文字小文字は区別する。 */
export const LOGIN_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/
export const LOGIN_ID_RULE = "半角英数字と「-」「_」で6文字以上20文字以下"

export const validateLoginId = (loginId: string): string[] =>
  LOGIN_ID_PATTERN.test(loginId) ? [] : [LOGIN_ID_RULE]
