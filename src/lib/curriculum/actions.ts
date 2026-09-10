"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db/client"
import {
  courseSessions,
  courses,
  jobCategories,
  patternDaySessions,
  sessionPatterns,
  teamCourses,
  trainingPrograms,
} from "@/db/schema"
import type { FormState } from "@/lib/auth/form-state"
import { requireRoles } from "@/lib/auth/guards"
import { now } from "@/lib/datetime"
import { COURSE_TOTAL_HOURS } from "./masters"
import {
  categoryEditSchema,
  categorySchema,
  courseEditSchema,
  courseSchema,
  patternEditSchema,
  patternSchema,
  programEditSchema,
  programSchema,
  sessionEditSchema,
  sessionSchema,
} from "./schema"
import { curriculumHref, type CurriculumView } from "./view"

/** カリキュラムのマスタを触れるのは事務員とシステム管理者だけ（5.7）。 */
const EDITORS = ["staff", "admin"] as const

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

/** 入力値をそのまま取り出す。検証エラー時の復元に使う。 */
const rawValues = (formData: FormData) =>
  Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as Record<
    string,
    string
  >

const invalid = (
  prev: FormState,
  values: Record<string, string>,
  fieldErrors: Record<string, string[]>,
): FormState => ({ errors: [], fieldErrors, values, attempt: (prev.attempt ?? 0) + 1 })

const failed = (prev: FormState, values: Record<string, string>, message: string): FormState => ({
  errors: [message],
  values,
  attempt: (prev.attempt ?? 0) + 1,
})

const back: (view: CurriculumView, extra: Record<string, string | number | undefined>) => never = (
  view,
  extra,
) => {
  revalidatePath("/curriculum")
  redirect(curriculumHref(view, extra))
}

/** 一度に INSERT する行数。開催パターンの追加では全コース分の割当を作る。 */
const CHUNK_SIZE = 500

const chunk = <T,>(rows: T[]) => {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    chunks.push(rows.slice(index, index + CHUNK_SIZE))
  }
  return chunks
}

/** count(*) の1行を数値で取り出す。 */
const countOf = (rows: { count: number }[]) => Number(rows[0]?.count ?? 0)

// ---------------------------------------------------------------------------
// 有効／無効
// ---------------------------------------------------------------------------

/**
 * 有効／無効を切り替えられる、コードを主キーに持つマスタ。
 *
 * テーブルそのものを画面から受け取ると、どのテーブルでも書き換えられてしまう。
 * ここに並べたものだけを対象にする。
 */
const CODE_MASTERS = {
  programs: trainingPrograms,
  categories: jobCategories,
  patterns: sessionPatterns,
} as const

type CodeMaster = keyof typeof CODE_MASTERS

/**
 * マスタの有効／無効を切り替える（5.7）。
 *
 * 現在の値を読んで反転させる。画面から次の値を受け取ると、
 * 一覧を開いたまま別の端末で切り替えられていたときに、古い値で上書きしてしまう。
 */
export async function toggleMasterActiveAction(
  master: CodeMaster,
  code: string,
  view: CurriculumView,
) {
  await requireRoles(EDITORS)

  const table = CODE_MASTERS[master]
  if (!table) throw new Error("対象のマスタがありません。")

  const [current] = await db
    .select({ isActive: table.isActive })
    .from(table)
    .where(eq(table.code, code))
    .limit(1)
  if (!current) back(view, { error: "notFound" })

  await db
    .update(table)
    .set({ isActive: !current.isActive, updatedAt: now() })
    .where(eq(table.code, code))

  back(view, { notice: current.isActive ? "deactivated" : "activated" })
}

/** コースの有効／無効を切り替える。コースだけは id で指す。 */
export async function toggleCourseActiveAction(courseId: number, view: CurriculumView) {
  await requireRoles(EDITORS)

  const [current] = await db
    .select({ isActive: courses.isActive })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  if (!current) back(view, { error: "notFound" })

  await db
    .update(courses)
    .set({ isActive: !current.isActive, updatedAt: now() })
    .where(eq(courses.id, courseId))

  back(view, { notice: current.isActive ? "deactivated" : "activated" })
}

// ---------------------------------------------------------------------------
// 研修プログラム
// ---------------------------------------------------------------------------

export async function createProgramAction(
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = programSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const [duplicate] = await db
    .select({ code: trainingPrograms.code })
    .from(trainingPrograms)
    .where(eq(trainingPrograms.code, parsed.data.code))
    .limit(1)
  if (duplicate) return failed(prev, values, "この研修プログラムコードはすでに登録されています。")

  const at = now()
  await db.insert(trainingPrograms).values({ ...parsed.data, createdAt: at, updatedAt: at })

  // 追加したものを選んだ状態にする。コースは研修プログラムに属するので選び直す
  back({ ...view, program: parsed.data.code, course: undefined }, { notice: "created" })
}

export async function updateProgramAction(
  code: string,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = programEditSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  await db
    .update(trainingPrograms)
    .set({ ...parsed.data, updatedAt: now() })
    .where(eq(trainingPrograms.code, code))

  back(view, { notice: "saved" })
}

export async function deleteProgramAction(code: string, view: CurriculumView) {
  await requireRoles(EDITORS)

  const courseCount = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(courses)
      .where(eq(courses.programCode, code)),
  )
  if (courseCount > 0) back(view, { error: "programHasCourses" })

  const teamCount = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(teamCourses)
      .where(eq(teamCourses.programCode, code)),
  )
  if (teamCount > 0) back(view, { error: "referenced" })

  await db.delete(trainingPrograms).where(eq(trainingPrograms.code, code))
  back({ ...view, program: undefined, course: undefined }, { notice: "deleted" })
}

// ---------------------------------------------------------------------------
// 職種カテゴリ
// ---------------------------------------------------------------------------

export async function createCategoryAction(
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = categorySchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const [duplicate] = await db
    .select({ code: jobCategories.code })
    .from(jobCategories)
    .where(eq(jobCategories.code, parsed.data.code))
    .limit(1)
  if (duplicate) return failed(prev, values, "この職種カテゴリコードはすでに登録されています。")

  const at = now()
  await db.insert(jobCategories).values({ ...parsed.data, createdAt: at, updatedAt: at })

  back({ ...view, category: parsed.data.code, course: undefined }, { notice: "created" })
}

export async function updateCategoryAction(
  code: string,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = categoryEditSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  await db
    .update(jobCategories)
    .set({ ...parsed.data, updatedAt: now() })
    .where(eq(jobCategories.code, code))

  back(view, { notice: "saved" })
}

export async function deleteCategoryAction(code: string, view: CurriculumView) {
  await requireRoles(EDITORS)

  const courseCount = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(courses)
      .where(eq(courses.categoryCode, code)),
  )
  if (courseCount > 0) back(view, { error: "categoryHasCourses" })

  const teamCount = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(teamCourses)
      .where(eq(teamCourses.categoryCode, code)),
  )
  if (teamCount > 0) back(view, { error: "referenced" })

  await db.delete(jobCategories).where(eq(jobCategories.code, code))
  back({ ...view, category: undefined, course: undefined }, { notice: "deleted" })
}

// ---------------------------------------------------------------------------
// コース
// ---------------------------------------------------------------------------

/**
 * コースを追加する。
 *
 * 講義コマは登録しない。コマ数は可変で（5.7）、内容も1コマずつ決めるため、
 * コースを作ってから「講義コマを追加」で足していく。
 * 日別コマ割当もコマを足したときに作られる。
 *
 * 作った直後は所要時間の合計が0時間で、5.7の「合計10時間」を満たさない。
 * ここでは止めず、外れているコースを画面で示す。
 */
export async function createCourseAction(
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = courseSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const [duplicate] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.programCode, parsed.data.programCode),
        eq(courses.courseNumber, parsed.data.courseNumber),
      ),
    )
    .limit(1)
  if (duplicate) {
    return failed(prev, values, "この研修プログラムには同じコース番号がすでに登録されています。")
  }

  const at = now()
  const [result] = await db.insert(courses).values({ ...parsed.data, createdAt: at, updatedAt: at })

  back({ ...view, course: String(Number(result.insertId)) }, { notice: "courseCreated" })
}

export async function updateCourseAction(
  courseId: number,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = courseEditSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  await db
    .update(courses)
    .set({ ...parsed.data, updatedAt: now() })
    .where(eq(courses.id, courseId))

  // 職種カテゴリを移すと、いま見ているカテゴリから外れる。移した先を見せる
  back({ ...view, category: parsed.data.categoryCode }, { notice: "saved" })
}

export async function deleteCourseAction(courseId: number, view: CurriculumView) {
  await requireRoles(EDITORS)

  const count = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(teamCourses)
      .where(eq(teamCourses.sourceCourseId, courseId)),
  )
  if (count > 0) back(view, { error: "referenced" })

  // 講義コマは courses への外部キーが cascade なので一緒に消える
  await db.delete(courses).where(eq(courses.id, courseId))
  back({ ...view, course: undefined }, { notice: "deleted" })
}

// ---------------------------------------------------------------------------
// 講義コマ
// ---------------------------------------------------------------------------

/**
 * 講義コマを編集する。
 *
 * コマ記号は開催パターンの日別割当と対応するため変えられない。
 * 表示順もここでは触らない。日の中の並びは開催パターンごとに持ち、
 * 日程のカードをドラッグして決める。
 * 所要時間の合計が10時間から外れても保存は通す。コマ数が可変になった以上、
 * 1コマずつ直す途中は必ず合計がずれるため、ここで止めると編集できなくなる。
 * 外れているコースは一覧の側で示す。
 */
export async function updateSessionAction(
  sessionId: number,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = sessionEditSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  await db
    .update(courseSessions)
    .set({
      durationHours: parsed.data.durationHours.toFixed(1),
      title: parsed.data.title,
      description: parsed.data.description,
      updatedAt: now(),
    })
    .where(eq(courseSessions.id, sessionId))

  back(view, { notice: "saved" })
}

/**
 * 講義コマを追加する。
 *
 * 表示順は入力させず、末尾に付ける。日の中の並びは開催パターンごとに持ち、
 * 追加したあとに日程のカードをドラッグして決める。
 * 日別コマ割当は全開催パターンとも初日の末尾に置く。
 */
export async function createSessionAction(
  courseId: number,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)

  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${courseSessions.displayOrder}), 0)` })
    .from(courseSessions)
    .where(eq(courseSessions.courseId, courseId))

  const parsed = sessionSchema.safeParse({
    ...values,
    displayOrder: Number(last?.max ?? 0) + 1,
  })
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const [duplicate] = await db
    .select({ id: courseSessions.id })
    .from(courseSessions)
    .where(
      and(
        eq(courseSessions.courseId, courseId),
        eq(courseSessions.sessionSymbol, parsed.data.sessionSymbol),
      ),
    )
    .limit(1)
  if (duplicate) {
    return failed(prev, values, "このコースには同じコマ記号がすでに登録されています。")
  }

  const at = now()
  const [result] = await db.insert(courseSessions).values({
    courseId,
    sessionSymbol: parsed.data.sessionSymbol,
    displayOrder: parsed.data.displayOrder,
    durationHours: parsed.data.durationHours.toFixed(1),
    title: parsed.data.title,
    description: parsed.data.description,
    createdAt: at,
    updatedAt: at,
  })

  const patterns = await db.select({ code: sessionPatterns.code }).from(sessionPatterns)
  // 初日の末尾に置く。開催パターンごとに並びが違うので、日の中の最大値から採る
  const tails = new Map(
    (
      await db
        .select({
          patternCode: patternDaySessions.patternCode,
          max: sql<number>`coalesce(max(${patternDaySessions.displayOrder}), 0)`,
        })
        .from(patternDaySessions)
        .innerJoin(courseSessions, eq(courseSessions.id, patternDaySessions.courseSessionId))
        .where(and(eq(courseSessions.courseId, courseId), eq(patternDaySessions.dayNumber, 1)))
        .groupBy(patternDaySessions.patternCode)
    ).map((row) => [row.patternCode, Number(row.max)]),
  )
  if (patterns.length > 0) {
    await db.insert(patternDaySessions).values(
      patterns.map((pattern) => ({
        patternCode: pattern.code,
        courseSessionId: Number(result.insertId),
        dayNumber: 1,
        displayOrder: (tails.get(pattern.code) ?? 0) + 1,
        createdAt: at,
        updatedAt: at,
      })),
    )
  }

  back(view, { notice: "sessionCreated" })
}

/** 講義コマを削除する。日別コマ割当は外部キーが cascade なので一緒に消える。 */
export async function deleteSessionAction(sessionId: number, view: CurriculumView) {
  await requireRoles(EDITORS)

  const [target] = await db
    .select({ courseId: courseSessions.courseId })
    .from(courseSessions)
    .where(eq(courseSessions.id, sessionId))
    .limit(1)
  if (!target) back(view, { error: "notFound" })

  // コマのないコースは開催パターンに当てはめようがない
  const siblings = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, target.courseId)),
  )
  if (siblings <= 1) back(view, { error: "lastSession" })

  await db.delete(courseSessions).where(eq(courseSessions.id, sessionId))
  back(view, { notice: "deleted" })
}

// ---------------------------------------------------------------------------
// 開催パターン
// ---------------------------------------------------------------------------

/**
 * 開催パターンを追加する。
 *
 * 日別コマ割当はコースごとに持つので、全コースの全コマ分を作る。
 * 初日にまとめて置き、日程はパターンごと・コースごとに調整してもらう。
 */
export async function createPatternAction(
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = patternSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const [duplicate] = await db
    .select({ code: sessionPatterns.code })
    .from(sessionPatterns)
    .where(eq(sessionPatterns.code, parsed.data.code))
    .limit(1)
  if (duplicate) return failed(prev, values, "この開催パターンコードはすでに登録されています。")

  const at = now()
  await db.insert(sessionPatterns).values({ ...parsed.data, createdAt: at, updatedAt: at })

  const sessions = await db
    .select({ id: courseSessions.id, displayOrder: courseSessions.displayOrder })
    .from(courseSessions)
  for (const rows of chunk(sessions)) {
    await db.insert(patternDaySessions).values(
      rows.map((session) => ({
        patternCode: parsed.data.code,
        courseSessionId: session.id,
        dayNumber: 1,
        displayOrder: session.displayOrder,
        createdAt: at,
        updatedAt: at,
      })),
    )
  }

  back({ ...view, pattern: parsed.data.code }, { notice: "patternCreated" })
}

export async function updatePatternAction(
  code: string,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = patternEditSchema.safeParse(values)
  if (!parsed.success) {
    return invalid(prev, values, parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  // 受講日数を減らすと、その先の日に置いたコマが宙に浮く
  const dayRows = await db
    .select({ maxDay: sql<number>`coalesce(max(${patternDaySessions.dayNumber}), 1)` })
    .from(patternDaySessions)
    .where(eq(patternDaySessions.patternCode, code))
  const maxDay = Number(dayRows[0]?.maxDay ?? 1)
  if (maxDay > parsed.data.days) {
    return failed(
      prev,
      values,
      `${maxDay} 日目にコマを割り当てています。先に日別コマ割当を直してください。`,
    )
  }

  await db
    .update(sessionPatterns)
    .set({ ...parsed.data, updatedAt: now() })
    .where(eq(sessionPatterns.code, code))

  back(view, { notice: "saved" })
}

export async function deletePatternAction(code: string, view: CurriculumView) {
  await requireRoles(EDITORS)

  const count = countOf(
    await db
      .select({ count: sql<number>`count(*)` })
      .from(teamCourses)
      .where(eq(teamCourses.patternCode, code)),
  )
  if (count > 0) back(view, { error: "referenced" })

  // 日別コマ割当は session_patterns への外部キーが cascade なので一緒に消える
  await db.delete(sessionPatterns).where(eq(sessionPatterns.code, code))
  back({ ...view, pattern: undefined }, { notice: "deleted" })
}

/**
 * 日別コマ割当を保存する（5.7）。
 *
 * いま開いているコースの分だけを受け取る。割当はコースごとに持つので、
 * 別のコースの日程は変わらない。コマの増減はここではできない。
 *
 * 割当の無いコマは作る。コマを追加した直後や、取り込みの取りこぼしで
 * どの日にも入っていないコマができたとき、画面から戻せるようにしておく。
 */
export async function updatePatternDaysAction(
  code: string,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)

  const [pattern] = await db
    .select({ days: sessionPatterns.days })
    .from(sessionPatterns)
    .where(eq(sessionPatterns.code, code))
    .limit(1)
  if (!pattern) return failed(prev, values, "開催パターンが見つかりません。")

  const requested = new Map<number, number>()
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith("day_")) continue
    const sessionId = Number(key.slice(4))
    if (Number.isInteger(sessionId)) requested.set(sessionId, Number(value))
  }
  if (requested.size === 0) return failed(prev, values, "割り当てる講義コマがありません。")

  const sessions = await db
    .select({ id: courseSessions.id, sessionSymbol: courseSessions.sessionSymbol })
    .from(courseSessions)
    .where(inArray(courseSessions.id, [...requested.keys()]))

  for (const session of sessions) {
    const day = requested.get(session.id)
    if (day === undefined || !Number.isInteger(day) || day < 1 || day > pattern.days) {
      return failed(prev, values, `「${session.sessionSymbol}」の日が 1〜${pattern.days} の外です。`)
    }
  }

  const existing = new Map(
    (
      await db
        .select({
          id: patternDaySessions.id,
          courseSessionId: patternDaySessions.courseSessionId,
          dayNumber: patternDaySessions.dayNumber,
        })
        .from(patternDaySessions)
        .where(
          and(
            eq(patternDaySessions.patternCode, code),
            inArray(patternDaySessions.courseSessionId, [...requested.keys()]),
          ),
        )
    ).map((row) => [row.courseSessionId, row]),
  )

  const at = now()
  for (const session of sessions) {
    const day = requested.get(session.id) ?? 1
    const current = existing.get(session.id)
    if (!current) {
      await db.insert(patternDaySessions).values({
        patternCode: code,
        courseSessionId: session.id,
        dayNumber: day,
        displayOrder: 1,
        createdAt: at,
        updatedAt: at,
      })
      continue
    }
    if (current.dayNumber !== day) {
      await db
        .update(patternDaySessions)
        .set({ dayNumber: day, updatedAt: at })
        .where(eq(patternDaySessions.id, current.id))
    }
  }

  back(view, { notice: "saved" })
}

/**
 * 1日ぶんの割当を並べ替える（5.7）。
 *
 * 画面のドラッグから呼ぶ。他のアクションと違って redirect しない。
 * 動かすたびに画面遷移して通知帯が出ると、続けて並べ替えられない。
 *
 * その日のコマを並び順どおりに丸ごと受け取り、表示順を振り直す。
 * 動いたものだけを送る形にすると、途中で失敗したときに順序が壊れる。
 * 割当が無ければ作る。未割当のコマを日へ入れるのも同じ操作になる。
 *
 * 書き込むのは pattern_day_sessions の表示順で、コース側のコマ順は動かさない。
 * 割当はパターンとコースの組ごとなので、ここでの並べ替えは他のパターンに及ばない。
 */
export async function arrangeDayAction(
  patternCode: string,
  dayNumber: number,
  sessionIds: number[],
) {
  await requireRoles(EDITORS)

  const [pattern] = await db
    .select({ days: sessionPatterns.days })
    .from(sessionPatterns)
    .where(eq(sessionPatterns.code, patternCode))
    .limit(1)
  if (!pattern) throw new Error("開催パターンが見つかりません。")
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > pattern.days) {
    throw new Error(`日が 1〜${pattern.days} の外です。`)
  }

  const ids = sessionIds.filter((id) => Number.isInteger(id))
  if (ids.length === 0) return
  if (new Set(ids).size !== ids.length) throw new Error("同じ講義コマが重複しています。")

  const rows = await db
    .select({ id: courseSessions.id, courseId: courseSessions.courseId })
    .from(courseSessions)
    .where(inArray(courseSessions.id, ids))
  if (rows.length !== ids.length) throw new Error("講義コマが見つかりません。")
  // 1日に並ぶのは1コースぶん。別のコースのコマが混ざる並びは受け取らない
  if (new Set(rows.map((row) => row.courseId)).size !== 1) {
    throw new Error("別のコースの講義コマが混ざっています。")
  }

  const existing = new Map(
    (
      await db
        .select({
          id: patternDaySessions.id,
          courseSessionId: patternDaySessions.courseSessionId,
          dayNumber: patternDaySessions.dayNumber,
          displayOrder: patternDaySessions.displayOrder,
        })
        .from(patternDaySessions)
        .where(
          and(
            eq(patternDaySessions.patternCode, patternCode),
            inArray(patternDaySessions.courseSessionId, ids),
          ),
        )
    ).map((row) => [row.courseSessionId, row]),
  )

  const at = now()
  for (const [index, sessionId] of ids.entries()) {
    const displayOrder = index + 1
    const current = existing.get(sessionId)
    if (!current) {
      await db.insert(patternDaySessions).values({
        patternCode,
        courseSessionId: sessionId,
        dayNumber,
        displayOrder,
        createdAt: at,
        updatedAt: at,
      })
      continue
    }
    if (current.dayNumber === dayNumber && current.displayOrder === displayOrder) continue
    await db
      .update(patternDaySessions)
      .set({ dayNumber, displayOrder, updatedAt: at })
      .where(eq(patternDaySessions.id, current.id))
  }

  revalidatePath("/curriculum")
}
