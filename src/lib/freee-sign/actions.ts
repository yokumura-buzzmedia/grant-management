"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { requireRoles } from "@/lib/auth/guards"
import { authorizeUrl, disconnect, freeeSignMode, missingSettings } from "."

/**
 * freeeサインとの接続（05_外部連携仕様.md 3.2）。
 *
 * 接続できるのはシステム管理者だけ。テナント全体の契約書を扱える権限を
 * 本システムへ預ける操作なので、案件を扱う事務員の権限とは分ける。
 */
const OPERATORS = ["admin"] as const

/** 認可の往復を突き合わせるための一時クッキー */
const STATE_COOKIE = "freee_sign_state"

/** 認可画面での操作にかかる時間。長く残す意味がない */
const STATE_TTL_SECONDS = 10 * 60

export async function readAuthorizationState() {
  return (await cookies()).get(STATE_COOKIE)?.value ?? null
}

export async function clearAuthorizationState() {
  ;(await cookies()).delete(STATE_COOKIE)
}

/**
 * 認可を開始する。
 *
 * `state` をクッキーに残してから freeeサインの認可画面へ送る。
 * freeeサインの仕様に `state` の定義が無く、返ってこない可能性があるため、
 * **クッキーの有無そのものを「この端末で認可を始めた」という印として使う**。
 * これが無ければ戻りを受け付けない。
 */
export async function startAuthorizationAction() {
  await requireRoles(OPERATORS)

  if (freeeSignMode() !== "live") redirect("/settings/freee-sign?error=notLive")
  if (missingSettings().length > 0) redirect("/settings/freee-sign?error=missingSettings")

  const state = randomBytes(32).toString("base64url")
  const store = await cookies()
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  })

  redirect(authorizeUrl(state))
}

/**
 * 接続を切る。
 * 保管しているトークンを捨てるだけで、freeeサイン側の文書には触れない。
 * 送付済みの契約書はそのまま残る。
 */
export async function disconnectAction() {
  await requireRoles(OPERATORS)
  await disconnect()
  revalidatePath("/settings/freee-sign")
  redirect("/settings/freee-sign?notice=disconnected")
}
