import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { and, eq, lt } from "drizzle-orm"
import { db } from "@/db/client"
import { sessions } from "@/db/schema"
import { daysFromNow, now } from "@/lib/datetime"

/**
 * セッション（01_要件定義.md 5.19）。
 *
 * - サーバー側に実体を持つ。トークンは平文を保存せず SHA-256 のみを保持する
 * - 権限はセッションに含めない。毎リクエスト user_roles を参照する
 * - 全端末ログアウトは user_id を条件とした削除で実現する
 */

export const SESSION_COOKIE = "gm_session"

/** ログイン時点から30日（5.19） */
const SESSION_DAYS = 30

/** last_used_at の更新頻度。毎リクエスト書き込むのを避ける。 */
const LAST_USED_REFRESH_MS = 60 * 60 * 1000

/** セッショントークンは平文を保存せず SHA-256 のみを保持する。 */
export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest()

export const readSessionToken = async () => (await cookies()).get(SESSION_COOKIE)?.value ?? null

export const findSessionByToken = (token: string) =>
  db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token))).limit(1)

/** セッションを発行し、Cookie に保存する。 */
export const createSession = async (
  userId: number,
  meta: { userAgent?: string | null; ipAddress?: Buffer | null } = {},
) => {
  const token = randomBytes(32).toString("base64url")
  const current = now()

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: daysFromNow(SESSION_DAYS),
    lastUsedAt: current,
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
    ipAddress: meta.ipAddress ?? null,
    createdAt: current,
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })

  return token
}

/** 通常のログアウト。操作した端末だけをログアウトさせる（5.19）。 */
export const destroyCurrentSession = async () => {
  const token = await readSessionToken()
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)))
  ;(await cookies()).delete(SESSION_COOKIE)
}

/**
 * 全端末ログアウト（5.19）。
 * パスワード変更・仮パスワード再発行・アカウント無効化・完全削除で使う。
 */
export const destroyAllSessions = async (userId: number) => {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

/** Cookie だけを消す。行の削除は destroyAllSessions が済ませている場合に使う。 */
export const clearSessionCookie = async () => {
  ;(await cookies()).delete(SESSION_COOKIE)
}

/** 期限切れの行を掃除する。ログイン時に呼ぶ。 */
export const purgeExpiredSessions = () =>
  db.delete(sessions).where(lt(sessions.expiresAt, now()))

/** 最終利用日時の更新。1時間以内に更新済みなら何もしない。 */
export const touchSession = async (sessionId: number, lastUsedAt: Date) => {
  const current = now()
  if (current.getTime() - lastUsedAt.getTime() < LAST_USED_REFRESH_MS) return
  await db
    .update(sessions)
    .set({ lastUsedAt: current })
    .where(and(eq(sessions.id, sessionId), lt(sessions.lastUsedAt, current)))
}
