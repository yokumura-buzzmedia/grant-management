"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { userRoles, users } from "@/db/schema"
import { now } from "@/lib/datetime"
import type { FormState } from "./form-state"
import { requireActiveUser, requireUser, initialPath } from "./guards"
import { hashPassword, verifyPassword } from "./password"
import { validateLoginId, validatePassword } from "./policy"
import { parseIpAddress } from "./request-meta"
import {
  createSession,
  destroyAllSessions,
  destroyCurrentSession,
  clearSessionCookie,
  purgeExpiredSessions,
} from "./session"

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "")

/** ログインIDの誤りとパスワードの誤りを区別せず、アカウントの存在を推測させない。 */
const LOGIN_FAILED = "ログインIDまたはパスワードが正しくありません。"

/**
 * A-01 ログイン。
 * ログインIDは大文字小文字を区別する（照合順序 utf8mb4_ja_0900_as_cs で担保）。
 */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const loginId = text(formData, "loginId")
  const password = text(formData, "password")

  if (!loginId || !password) {
    return { errors: ["ログインIDとパスワードを入力してください。"] }
  }

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      isTemporaryPassword: users.isTemporaryPassword,
    })
    .from(users)
    .where(eq(users.loginId, loginId))
    .limit(1)

  // 利用者が居ない場合もダミーハッシュと照合し、応答時間を揃える
  const matched = await verifyPassword(user?.passwordHash ?? null, password)

  // 無効なアカウントはログインできない（5.4）。理由は画面に出さない
  if (!user || !user.isActive || !matched) {
    return { errors: [LOGIN_FAILED] }
  }

  const header = await headers()
  await createSession(user.id, {
    userAgent: header.get("user-agent"),
    ipAddress: parseIpAddress(header.get("x-forwarded-for") ?? header.get("x-real-ip")),
  })
  await purgeExpiredSessions()

  // 仮パスワードでのログインは、発行理由を問わず A-02 を経由させる（5.4）
  if (user.isTemporaryPassword) redirect("/password/setup")

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id))

  redirect(initialPath(roles.map((r) => r.role)))
}

/** 通常のログアウト。操作した端末だけをログアウトさせる（5.19）。 */
export async function logoutAction() {
  await destroyCurrentSession()
  redirect("/login")
}

/**
 * パスワードの設定（A-02 初回設定 / A-03 変更）。
 *
 * 変更時に現在のパスワードは求めない（5.4）。
 * 設定後は操作した端末を含むすべての端末からログアウトさせる（5.19）。
 */
const savePassword = async (
  userId: number,
  formData: FormData,
  redirectTo: string,
): Promise<FormState> => {
  const password = text(formData, "password")
  const confirmation = text(formData, "confirmation")

  const errors = validatePassword(password)
  if (password !== confirmation) errors.push("確認用のパスワードが一致しません。")
  if (errors.length > 0) return { errors }

  const current = now()
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      isTemporaryPassword: false,
      updatedAt: current,
      updatedBy: userId,
    })
    .where(eq(users.id, userId))

  await destroyAllSessions(userId)
  await clearSessionCookie()
  redirect(redirectTo)
}

/** A-02 初回パスワード設定。仮パスワードでログインした直後に必ず経由する。 */
export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()
  return savePassword(user.id, formData, "/login?notice=password-set")
}

/** A-03 パスワード変更。 */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireActiveUser()
  return savePassword(user.id, formData, "/login?notice=password-changed")
}

/**
 * A-04 ログインID変更。
 * 本人による変更は現在のパスワード入力を必須とし、変更後はログアウトさせる（5.4）。
 */
export async function changeLoginIdAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireActiveUser()
  const loginId = text(formData, "loginId")
  const password = text(formData, "password")

  const errors = validateLoginId(loginId)
  if (loginId === user.loginId) errors.push("現在のログインIDと同じです。")
  if (!password) errors.push("現在のパスワードを入力してください。")
  if (errors.length > 0) return { errors }

  const [record] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!(await verifyPassword(record?.passwordHash ?? null, password))) {
    return { errors: ["現在のパスワードが正しくありません。"] }
  }

  const [duplicate] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginId, loginId))
    .limit(1)

  if (duplicate) return { errors: ["このログインIDは既に使われています。"] }

  try {
    await db
      .update(users)
      .set({ loginId, updatedAt: now(), updatedBy: user.id })
      .where(eq(users.id, user.id))
  } catch (error) {
    // 一意制約違反。上の確認との間に別の利用者が同じIDを取得した場合
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      return { errors: ["このログインIDは既に使われています。"] }
    }
    throw error
  }

  await destroyAllSessions(user.id)
  await clearSessionCookie()
  redirect("/login?notice=login-id-changed")
}
