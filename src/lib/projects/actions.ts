"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, deletionLogs, projects, userRoles, users, type ProjectStatus } from "@/db/schema"
import type { FormState } from "@/lib/auth/form-state"
import { requireRoles } from "@/lib/auth/guards"
import { now } from "@/lib/datetime"
import { formatProjectNumber, parseProjectNumber } from "./number"
import { projectEditSchema, projectSchema } from "./schema"
import { isProjectStatus, nextStatus } from "./status"
import { findTransitionBlockers } from "./transition"

/** 申請案件を作成・削除できるのは事務員とシステム管理者だけ（5.15）。 */
const EDITORS = ["staff", "admin"] as const

/** 採番が重なったときのやり直し回数。 */
const NUMBER_RETRIES = 5

/** 一意制約に弾かれたか。番号が重なったときだけやり直す */
const isDuplicate = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"

/**
 * C-09 申請案件の作成（5.15, 5.16）。
 *
 * ステータスは「営業中」で作る。営業を開始した時点で申請案件を作成し、
 * 1つのレコードが最後まで持ち回る（5.15）。
 *
 * 案件番号は既存の最大値＋1で採る。同時に作成されて一意制約に弾かれたときは
 * 採り直す。カウンタのテーブルを増やさずに重複を防ぐため。
 */
export async function createProjectAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireRoles(EDITORS)

  const values = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  ) as Record<string, string>
  const parsed = projectSchema.safeParse(values)
  if (!parsed.success) {
    return {
      errors: [],
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      values,
      attempt: (prev.attempt ?? 0) + 1,
    }
  }

  const failed = (message: string): FormState => ({
    errors: [message],
    values,
    attempt: (prev.attempt ?? 0) + 1,
  })

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, parsed.data.companyId))
    .limit(1)
  if (!company) return failed("選択した会社が見つかりません。")

  // 主担当は事務員かシステム管理者に限る（5.16）
  const [staff] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(users.id, parsed.data.primaryStaffId),
        eq(users.isActive, true),
        inArray(userRoles.role, [...EDITORS]),
      ),
    )
    .limit(1)
  if (!staff) return failed("主担当には、有効な事務員またはシステム管理者を選んでください。")

  const at = now()
  for (let attempt = 0; attempt < NUMBER_RETRIES; attempt += 1) {
    const [last] = await db
      .select({ projectNumber: projects.projectNumber })
      .from(projects)
      .orderBy(desc(projects.projectNumber))
      .limit(1)
    const projectNumber = formatProjectNumber(parseProjectNumber(last?.projectNumber) + 1)

    try {
      await db.insert(projects).values({
        projectNumber,
        name: parsed.data.name,
        companyId: parsed.data.companyId,
        status: "prospecting",
        primaryStaffId: staff.id,
        // アカウントを削除しても表示名を残す（5.4 / DB論理設計の削除方針）
        primaryStaffName: staff.displayName,
        createdAt: at,
        createdBy: actor.id,
        updatedAt: at,
        updatedBy: actor.id,
      })
    } catch (error) {
      if (isDuplicate(error) && attempt < NUMBER_RETRIES - 1) continue
      throw error
    }

    revalidatePath("/projects")
    redirect("/projects?notice=created")
  }

  return failed("案件番号の発行に失敗しました。時間をおいて、もう一度お試しください。")
}

/**
 * 主担当に指定できる利用者か（5.16）。
 * 有効な事務員またはシステム管理者に限る。表示名はスナップショット用に返す。
 */
const findAssignableStaff = async (userId: number) => {
  const [staff] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(eq(users.id, userId), eq(users.isActive, true), inArray(userRoles.role, [...EDITORS])),
    )
    .limit(1)
  return staff
}

/**
 * C-02 基本情報の更新（5.16, 5.17）。
 *
 * 変えられるのは案件名と主担当だけ。案件番号は自動発行、会社は登録後に変えない。
 * 変更前後の内容は残さず、最終更新日時と更新者だけを持つ（5.17）。
 */
export async function updateProjectAction(
  projectId: number,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireRoles(EDITORS)

  const values = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  ) as Record<string, string>
  const parsed = projectEditSchema.safeParse(values)
  if (!parsed.success) {
    return {
      errors: [],
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      values,
      attempt: (prev.attempt ?? 0) + 1,
    }
  }

  const staff = await findAssignableStaff(parsed.data.primaryStaffId)
  if (!staff) {
    return {
      errors: ["主担当には、有効な事務員またはシステム管理者を選んでください。"],
      values,
      attempt: (prev.attempt ?? 0) + 1,
    }
  }

  await db
    .update(projects)
    .set({
      name: parsed.data.name,
      primaryStaffId: staff.id,
      // アカウントを削除しても表示名を残す（5.4 / DB論理設計の削除方針）
      primaryStaffName: staff.displayName,
      updatedAt: now(),
      updatedBy: actor.id,
    })
    .where(eq(projects.id, projectId))

  revalidatePath("/projects")
  redirect(`/projects/${projectId}?notice=saved`)
}

/** 案件詳細へ戻す。操作の結果は画面上部の帯で伝える */
const backToProject = (projectId: number, kind: "notice" | "error", value: string) =>
  `/projects/${projectId}?${kind}=${value}`

/**
 * ステータスの変更（5.1 / 06_画面設計.md C-02）。
 *
 * 事務員が選べるのは次の1つだけ。順序どおりに進み、前へ戻すことも飛ばすこともできない。
 * 例外は「完了」と「問い合わせ」の往復で、ここだけ双方向に変更できる。
 *
 * 順序を外れた変更はシステム管理者だけが実行できる。誤操作の取り消しのための逃げ道で、
 * 前提条件も見ない。前提を満たせなくなった状態から抜け出すための操作でもあるため。
 *
 * 画面には変更前のステータスも送らせる。開いたままの画面から、
 * 既に別の利用者が進めたあとの古い遷移が実行されるのを防ぐ。
 */
export async function changeProjectStatusAction(projectId: number, formData: FormData) {
  const actor = await requireRoles(EDITORS)

  const [project] = await db
    .select({ id: projects.id, status: projects.status, companyId: projects.companyId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!project) redirect("/projects")

  const back = (kind: "notice" | "error", value: string) => backToProject(project.id, kind, value)

  // 別の利用者が先に変更した場合。見えていたものと違う遷移は実行しない
  if (String(formData.get("current") ?? "") !== project.status) redirect(back("error", "stale"))

  const target = String(formData.get("status") ?? "")
  if (!isProjectStatus(target)) redirect(back("error", "invalidStatus"))
  if (target === project.status) redirect(back("error", "sameStatus"))

  if (target === nextStatus(project.status)) {
    // 画面にも同じ理由を出しているが、画面の状態は古くなるのでここで引き直す
    const blockers = await findTransitionBlockers(target, project.companyId)
    if (blockers.length > 0) redirect(back("error", "blocked"))
  } else if (!actor.roles.includes("admin")) {
    redirect(back("error", "outOfOrder"))
  }

  await db
    .update(projects)
    .set({ status: target, updatedAt: now(), updatedBy: actor.id })
    .where(eq(projects.id, project.id))

  revalidatePath("/projects")
  redirect(back("notice", "statusChanged"))
}

/**
 * 申請案件の完全削除（5.15）。
 *
 * 物理削除で復元できない。削除理由は求めない。ステータスに関わらず削除できる。
 * 案件専用の書類・予約・チーム・掲示板投稿は外部キーの連鎖で消える。
 * 会社・クライアントアカウント・受講者は残る。
 *
 * 本体が消えるため、案件番号と会社名を deletion_logs へ複製して残す（5.15, 5.17）。
 */
export async function deleteProjectAction(projectId: number) {
  const actor = await requireRoles(EDITORS)

  const [project] = await db
    .select({
      id: projects.id,
      projectNumber: projects.projectNumber,
      companyName: companies.name,
    })
    .from(projects)
    .innerJoin(companies, eq(companies.id, projects.companyId))
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!project) redirect("/projects")

  await db.transaction(async (tx) => {
    await tx.insert(deletionLogs).values({
      targetType: "project",
      deletedBy: actor.id,
      deletedByName: actor.displayName,
      deletedAt: now(),
      detail: { projectNumber: project.projectNumber, companyName: project.companyName },
    })
    await tx.delete(projects).where(eq(projects.id, project.id))
  })

  revalidatePath("/projects")
  revalidatePath("/deletion-logs")
  redirect("/projects?notice=deleted")
}
