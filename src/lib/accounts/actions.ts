"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { accountReturnPath } from "@/lib/accounts/return-path"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, userRoles, users, type UserRole } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { destroyAllSessions } from "@/lib/auth/session"
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password"
import { validateLoginId } from "@/lib/auth/policy"
import { now } from "@/lib/datetime"
import { creatableRoles } from "@/lib/roles"
import { canManage, countActiveAdmins, findAccount } from "./authorize"
import type { AccountFormState } from "./state"

/** アカウントを作成できるのは事務員とシステム管理者（5.4）。 */
const CREATORS = ["staff", "admin"] as const

const DUPLICATE_LOGIN_ID = "このログインIDは既に使われています。"

type Draft = {
  loginId: string
  displayName: string
  roles: UserRole[]
  companyId: number | null
}

/** ログインIDと利用者名の共通チェック（5.4）。 */
const validateBasics = (draft: Draft) => {
  const fieldErrors: Record<string, string[]> = {}

  const loginIdErrors = validateLoginId(draft.loginId)
  if (loginIdErrors.length > 0) fieldErrors.loginId = loginIdErrors

  if (draft.displayName === "") {
    fieldErrors.displayName = ["利用者名を入力してください。"]
  } else if (draft.displayName.length > 100) {
    fieldErrors.displayName = ["利用者名は100文字以内で入力してください。"]
  }
  return fieldErrors
}

/**
 * アカウントを1件作成し、仮パスワードを返す（5.4）。
 *
 * 仮パスワードは保存も再表示もしない。事務員がメールまたはLINEで本人へ個別に伝える。
 */
const insertAccount = async (draft: Draft, actorId: number) => {
  // ログインIDはシステム全体で重複不可。大文字小文字は照合順序で区別される
  const [duplicate] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginId, draft.loginId))
    .limit(1)
  if (duplicate) return { duplicate: true as const }

  const temporaryPassword = generateTemporaryPassword()
  const current = now()

  try {
    await db.transaction(async (tx) => {
      const [result] = await tx.insert(users).values({
        loginId: draft.loginId,
        displayName: draft.displayName,
        passwordHash: await hashPassword(temporaryPassword),
        isTemporaryPassword: true,
        isActive: true,
        companyId: draft.companyId,
        createdAt: current,
        createdBy: actorId,
        updatedAt: current,
        updatedBy: actorId,
      })
      const userId = Number(result.insertId)
      await tx
        .insert(userRoles)
        .values(draft.roles.map((role) => ({ userId, role, createdAt: current })))
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      return { duplicate: true as const }
    }
    throw error
  }

  return { duplicate: false as const, temporaryPassword }
}

const failure = (
  prev: AccountFormState,
  values: Record<string, string | string[]>,
  fieldErrors: Record<string, string[]>,
): AccountFormState => ({
  errors: [],
  fieldErrors,
  values,
  attempt: (prev.attempt ?? 0) + 1,
})

/**
 * G-02 アカウントの作成（5.4）。
 * クライアントは所属会社が決まるため、この画面では作成しない（会社詳細から作成する）。
 */
export async function createAccountAction(
  prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const actor = await requireRoles(CREATORS)

  const draft: Draft = {
    loginId: String(formData.get("loginId") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    roles: formData.getAll("roles").map(String) as UserRole[],
    companyId: null,
  }
  const values = { ...draft, roles: draft.roles as string[], companyId: "" }

  const fieldErrors = validateBasics(draft)

  // 自分に許されていない権限は付与できない。クライアントもここでは選べない
  const allowed = creatableRoles(actor.roles)
  if (draft.roles.length === 0) {
    fieldErrors.roles = ["権限を1つ以上選んでください。"]
  } else if (draft.roles.some((role) => !allowed.includes(role))) {
    fieldErrors.roles = ["選べない権限が含まれています。"]
  }

  if (Object.keys(fieldErrors).length > 0) return failure(prev, values, fieldErrors)

  const result = await insertAccount(draft, actor.id)
  if (result.duplicate) return failure(prev, values, { loginId: [DUPLICATE_LOGIN_ID] })

  revalidatePath("/accounts")
  return {
    errors: [],
    created: {
      loginId: draft.loginId,
      displayName: draft.displayName,
      temporaryPassword: result.temporaryPassword,
    },
  }
}

/**
 * D-02 会社詳細からのクライアントアカウント作成（5.3, 5.4）。
 *
 * 1つのクライアントアカウントは1社だけに所属し、作成後に所属会社は変更しない。
 * 会社を画面から選ばせず、開いている会社に固定する。
 */
export async function createClientAccountAction(
  companyId: number,
  prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const actor = await requireRoles(CREATORS)

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
  if (!company) return { errors: ["会社が見つかりません。"] }

  const draft: Draft = {
    loginId: String(formData.get("loginId") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    roles: ["client"],
    companyId,
  }
  const values = { loginId: draft.loginId, displayName: draft.displayName }

  const fieldErrors = validateBasics(draft)
  if (Object.keys(fieldErrors).length > 0) return failure(prev, values, fieldErrors)

  const result = await insertAccount(draft, actor.id)
  if (result.duplicate) return failure(prev, values, { loginId: [DUPLICATE_LOGIN_ID] })

  revalidatePath(`/companies/${companyId}`)
  revalidatePath("/accounts")
  return {
    errors: [],
    created: {
      loginId: draft.loginId,
      displayName: draft.displayName,
      temporaryPassword: result.temporaryPassword,
    },
  }
}

// ---------------------------------------------------------------------------
// 編集（5.4）
// ---------------------------------------------------------------------------

const NOT_ALLOWED = "このアカウントを操作する権限がありません。"

/**
 * 利用者名・ログインID・権限の変更（5.4）。
 *
 * - 事務員はシステム管理者のアカウントを操作できない
 * - 事務員は事務員権限・システム管理者権限を付与できない
 * - 有効なシステム管理者が1人だけの場合、その管理者権限は解除できない
 * - ログインIDを変更した場合は、その利用者を全端末からログアウトさせる（5.19）
 *
 * クライアントと代理店の権限はこの画面では変更しない。所属会社・所属代理店と対になるため、
 * 現在の設定をそのまま引き継ぐ。
 */
const FIXED_ROLES: UserRole[] = ["client", "agency"]

export async function updateAccountAction(
  targetId: number,
  /** 会社詳細から呼ばれた場合の会社ID。保存後にその画面へ戻す */
  returnCompanyId: number | null,
  prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const actor = await requireRoles(CREATORS)
  const target = await findAccount(targetId)
  if (!target) return { errors: ["アカウントが見つかりません。"] }
  if (!canManage(actor.roles, target)) return { errors: [NOT_ALLOWED] }

  const loginId = String(formData.get("loginId") ?? "").trim()
  const displayName = String(formData.get("displayName") ?? "").trim()
  const selected = formData.getAll("roles").map(String) as UserRole[]
  const values = { loginId, displayName, roles: selected as string[] }

  const fieldErrors = validateBasics({ loginId, displayName, roles: selected, companyId: null })

  const assignable = creatableRoles(actor.roles)
  if (selected.some((role) => !assignable.includes(role))) {
    fieldErrors.roles = ["選べない権限が含まれています。"]
  }

  // クライアント・代理店の権限は画面から変更しないため、現在の設定を引き継ぐ
  const kept = target.roles.filter((role) => FIXED_ROLES.includes(role))
  const nextRoles = [...new Set([...kept, ...selected])]
  if (nextRoles.length === 0) fieldErrors.roles = ["権限を1つ以上選んでください。"]

  // 有効なシステム管理者が1人だけの場合、その管理者権限は解除できない（5.4）
  if (
    target.roles.includes("admin") &&
    !nextRoles.includes("admin") &&
    target.isActive &&
    (await countActiveAdmins(target.id)) === 0
  ) {
    fieldErrors.roles = ["有効なシステム管理者が1人だけのため、管理者権限は解除できません。"]
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { errors: [], fieldErrors, values, attempt: (prev.attempt ?? 0) + 1 }
  }

  const loginIdChanged = loginId !== target.loginId
  if (loginIdChanged) {
    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.loginId, loginId))
      .limit(1)
    if (duplicate) {
      return {
        errors: [],
        fieldErrors: { loginId: [DUPLICATE_LOGIN_ID] },
        values,
        attempt: (prev.attempt ?? 0) + 1,
      }
    }
  }

  const current = now()
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ loginId, displayName, updatedAt: current, updatedBy: actor.id })
        .where(eq(users.id, target.id))

      await tx.delete(userRoles).where(eq(userRoles.userId, target.id))
      await tx
        .insert(userRoles)
        .values(nextRoles.map((role) => ({ userId: target.id, role, createdAt: current })))
    })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      return {
        errors: [],
        fieldErrors: { loginId: [DUPLICATE_LOGIN_ID] },
        values,
        attempt: (prev.attempt ?? 0) + 1,
      }
    }
    throw error
  }

  // ログインIDを変更したら再ログインが必要（5.4）。権限の変更は次のリクエストで自動的に反映される
  if (loginIdChanged) await destroyAllSessions(target.id)

  revalidatePath("/accounts")
  revalidatePath(`/accounts/${target.id}`)
  if (returnCompanyId) revalidatePath(`/companies/${returnCompanyId}`)
  redirect(accountReturnPath(target.id, returnCompanyId, "notice", "saved"))
}

/**
 * 有効・無効の切り替え（5.4, 5.19）。
 * 無効にしたアカウントは直ちに全端末からログアウトさせる。
 */
export async function setAccountActiveAction(
  targetId: number,
  nextActive: boolean,
  /** 会社詳細から呼ばれた場合の会社ID。切り替え後にその画面へ戻す */
  returnCompanyId: number | null = null,
) {
  const actor = await requireRoles(CREATORS)
  const target = await findAccount(targetId)
  if (!target) redirect("/accounts")
  const back = (kind: "notice" | "error", value: string) =>
    accountReturnPath(targetId, returnCompanyId, kind, value)
  if (!canManage(actor.roles, target)) redirect(back("error", "forbidden"))

  if (!nextActive) {
    // システム管理者は自分自身を無効にできない（5.4）
    if (target.id === actor.id) redirect(back("error", "self"))
    // 有効なシステム管理者が1人だけの場合は無効にできない（5.4）
    if (target.roles.includes("admin") && (await countActiveAdmins(target.id)) === 0) {
      redirect(back("error", "lastAdmin"))
    }
  }

  await db
    .update(users)
    .set({ isActive: nextActive, updatedAt: now(), updatedBy: actor.id })
    .where(eq(users.id, target.id))

  if (!nextActive) await destroyAllSessions(target.id)

  revalidatePath("/accounts")
  if (returnCompanyId) revalidatePath(`/companies/${returnCompanyId}`)
  redirect(back("notice", nextActive ? "activated" : "deactivated"))
}

/**
 * 仮パスワードの再生成（5.4, 5.19）。
 * 事務員はシステム管理者の仮パスワードを再生成できない。
 * 再生成したらそのアカウントの全端末をログアウトさせる。
 */
export async function regeneratePasswordAction(
  targetId: number,
  prev: AccountFormState,
): Promise<AccountFormState> {
  const actor = await requireRoles(CREATORS)
  const target = await findAccount(targetId)
  if (!target) return { errors: ["アカウントが見つかりません。"] }
  if (!canManage(actor.roles, target)) return { errors: [NOT_ALLOWED] }

  const temporaryPassword = generateTemporaryPassword()
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(temporaryPassword),
      isTemporaryPassword: true,
      updatedAt: now(),
      updatedBy: actor.id,
    })
    .where(eq(users.id, target.id))

  await destroyAllSessions(target.id)

  revalidatePath(`/accounts/${target.id}`)
  return {
    errors: [],
    attempt: (prev.attempt ?? 0) + 1,
    created: {
      loginId: target.loginId,
      displayName: target.displayName,
      temporaryPassword,
    },
  }
}
