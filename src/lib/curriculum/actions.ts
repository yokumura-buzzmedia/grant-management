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

/**
 * コースの全コマを、全開催パターンの初日に割り当てる。
 * 割当はコースごとに持つため、コースを作ったらパターンの数だけ必要になる。
 */
const assignToAllPatterns = async (courseId: number, at: Date) => {
  const [sessions, patterns] = await Promise.all([
    db
      .select({ id: courseSessions.id, displayOrder: courseSessions.displayOrder })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, courseId)),
    db.select({ code: sessionPatterns.code }).from(sessionPatterns),
  ])
  if (sessions.length === 0 || patterns.length === 0) return

  const rows = patterns.flatMap((pattern) =>
    sessions.map((session) => ({
      patternCode: pattern.code,
      courseSessionId: session.id,
      dayNumber: 1,
      displayOrder: session.displayOrder,
      createdAt: at,
      updatedAt: at,
    })),
  )
  for (const part of chunk(rows)) await db.insert(patternDaySessions).values(part)
}

/**
 * コース追加フォームの講義コマを読む。
 * 行数は可変で、session0Title … と続くところまでを1コースぶんとする。
 */
const readSessionRows = (values: Record<string, string>) => {
  const rows: {
    sessionSymbol: string
    displayOrder: number
    durationHours: number
    title: string
    description: string | null
  }[] = []
  const errors: Record<string, string[]> = {}

  for (let index = 0; values[`session${index}Title`] !== undefined; index += 1) {
    const row = sessionSchema.safeParse({
      sessionSymbol: values[`session${index}Symbol`] ?? "",
      displayOrder: index + 1,
      durationHours: values[`session${index}Hours`] ?? "",
      title: values[`session${index}Title`] ?? "",
      description: values[`session${index}Description`] ?? "",
    })
    if (row.success) {
      rows.push(row.data)
      continue
    }
    // 行ごとの入力欄に返せるよう、項目名に行番号を付け直す
    for (const [key, messages] of Object.entries(row.error.flatten().fieldErrors)) {
      const suffix = SESSION_FIELDS[key]
      if (suffix && messages) errors[`session${index}${suffix}`] = messages
    }
  }

  return { rows, errors }
}

/** 講義コマの項目名と、コース追加フォームでの入力欄名の対応。 */
const SESSION_FIELDS: Record<string, string> = {
  sessionSymbol: "Symbol",
  durationHours: "Hours",
  title: "Title",
  description: "Description",
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
 * 講義コマの数は可変（5.7）。あとから足していく作りにすると、途中はずっと
 * 所要時間の合計が10時間から外れるため、コマ一式をコースと同時に受け取る。
 *
 * 日別コマ割当はコースごとに持つので、ここで全開催パターン分を作る。
 * 初日にまとめて置き、日程は追加後に調整してもらう。
 */
export async function createCourseAction(
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = courseSchema.safeParse(values)
  const fieldErrors: Record<string, string[]> = parsed.success
    ? {}
    : (parsed.error.flatten().fieldErrors as Record<string, string[]>)

  const { rows, errors } = readSessionRows(values)
  Object.assign(fieldErrors, errors)
  if (Object.keys(fieldErrors).length > 0) return invalid(prev, values, fieldErrors)
  if (!parsed.success) return invalid(prev, values, fieldErrors)
  if (rows.length === 0) return failed(prev, values, "講義コマを1つ以上入力してください。")

  const symbols = rows.map((row) => row.sessionSymbol)
  if (new Set(symbols).size !== symbols.length) {
    return failed(prev, values, "コマ記号が重複しています。コマごとに別の記号を付けてください。")
  }

  const total = rows.reduce((sum, row) => sum + row.durationHours, 0)
  if (total !== COURSE_TOTAL_HOURS) {
    return failed(
      prev,
      values,
      `所要時間の合計が ${total} 時間です。${COURSE_TOTAL_HOURS} 時間になるよう調整してください。`,
    )
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
  const courseId = Number(result.insertId)

  await db.insert(courseSessions).values(
    rows.map((row) => ({
      courseId,
      sessionSymbol: row.sessionSymbol,
      displayOrder: row.displayOrder,
      // decimal(3,1) に合わせる。0.5時間単位なので桁は落ちない
      durationHours: row.durationHours.toFixed(1),
      title: row.title,
      description: row.description,
      createdAt: at,
      updatedAt: at,
    })),
  )

  await assignToAllPatterns(courseId, at)
  back({ ...view, course: String(courseId) }, { notice: "courseCreated" })
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
      displayOrder: parsed.data.displayOrder,
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
 * 日別コマ割当は全開催パターンとも初日に置く。何日目かは割当の編集で決める。
 */
export async function createSessionAction(
  courseId: number,
  view: CurriculumView,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRoles(EDITORS)
  const values = rawValues(formData)
  const parsed = sessionSchema.safeParse(values)
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
  if (patterns.length > 0) {
    await db.insert(patternDaySessions).values(
      patterns.map((pattern) => ({
        patternCode: pattern.code,
        courseSessionId: Number(result.insertId),
        dayNumber: 1,
        displayOrder: parsed.data.displayOrder,
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

  const ids = Object.keys(values)
    .filter((key) => key.startsWith("day_"))
    .map((key) => Number(key.slice(4)))
    .filter((id) => Number.isInteger(id))
  if (ids.length === 0) return failed(prev, values, "割り当てる講義コマがありません。")

  const rows = await db
    .select({
      id: patternDaySessions.id,
      courseSessionId: patternDaySessions.courseSessionId,
      dayNumber: patternDaySessions.dayNumber,
      sessionSymbol: courseSessions.sessionSymbol,
    })
    .from(patternDaySessions)
    .innerJoin(courseSessions, eq(courseSessions.id, patternDaySessions.courseSessionId))
    .where(
      and(
        eq(patternDaySessions.patternCode, code),
        inArray(patternDaySessions.courseSessionId, ids),
      ),
    )

  const at = now()
  const updates: { id: number; dayNumber: number }[] = []
  for (const row of rows) {
    const day = Number(values[`day_${row.courseSessionId}`])
    if (!Number.isInteger(day) || day < 1 || day > pattern.days) {
      return failed(prev, values, `「${row.sessionSymbol}」の日が 1〜${pattern.days} の外です。`)
    }
    if (day !== row.dayNumber) updates.push({ id: row.id, dayNumber: day })
  }

  for (const update of updates) {
    await db
      .update(patternDaySessions)
      .set({ dayNumber: update.dayNumber, updatedAt: at })
      .where(eq(patternDaySessions.id, update.id))
  }

  back(view, { notice: "saved" })
}
