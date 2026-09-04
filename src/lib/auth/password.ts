import { randomBytes, randomInt } from "node:crypto"
import { hash, verify } from "@node-rs/argon2"

/**
 * パスワードのハッシュ化（03_技術選定.md 5.2）。
 *
 * パラメータは OWASP の推奨値。@node-rs/argon2 の既定アルゴリズムは Argon2id で、
 * 生成されるハッシュの接頭辞は `$argon2id$` になる。
 * `Algorithm` は const enum のため isolatedModules 下では import できず、既定値に委ねている。
 */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export const hashPassword = (password: string) => hash(password, ARGON2_OPTIONS)

/**
 * 存在しないログインIDでも同じ計算量を消費させ、応答時間からアカウントの有無を
 * 推測されないようにするためのダミーハッシュ。プロセスごとに一度だけ生成する。
 */
let dummyHash: Promise<string> | null = null
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(32).toString("hex")))

/** ハッシュが無い場合もダミーと照合し、常に同じ処理時間をかける。 */
export const verifyPassword = async (passwordHash: string | null, password: string) => {
  const target = passwordHash ?? (await getDummyHash())
  try {
    const matched = await verify(target, password, ARGON2_OPTIONS)
    return passwordHash === null ? false : matched
  } catch {
    // ハッシュの形式が壊れている場合も認証失敗として扱う
    return false
  }
}

/**
 * 仮パスワードの自動発行（5.4）。
 * メールやLINEで手入力により伝えるため、見分けにくい 0 O 1 l I は使わない。
 * 英字と数字を1文字以上含めるので、通常パスワードと同じ条件を満たす。
 */
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"

export const generateTemporaryPassword = (length = 12) => {
  const pool = LETTERS + DIGITS
  const chars = [
    LETTERS[randomInt(LETTERS.length)]!,
    DIGITS[randomInt(DIGITS.length)]!,
    ...Array.from({ length: length - 2 }, () => pool[randomInt(pool.length)]!),
  ]
  // Fisher-Yates で並びを崩し、先頭2文字の文字種が固定されないようにする
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join("")
}
