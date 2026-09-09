/**
 * カリキュラムマスタの CSV 取り込み（01_要件定義.md 5.7）。
 *
 * マスタごとに1ファイル。初期データは `docs/data/` に置き、CLI（`db:curriculum`）と
 * F-02 CSVインポート画面の両方からこの関数を通す。取り込み経路を分けると、
 * 画面からだけ通る検証・CLI からだけ通る検証ができて、片方でデータが壊れる。
 *
 * 取り込みは追加と更新だけで、CSV に無い行は消さない。
 * `is_active` も更新しない。無効にしたマスタが再取り込みで有効に戻ると、
 * 新規の選択肢から外したはずのものが復活してしまう（5.7「マスタの変更・削除」）。
 */
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import {
  courseSessions,
  courses,
  jobCategories,
  patternDaySessions,
  sessionPatterns,
  trainingPrograms,
} from "@/db/schema"
import { parseCsv, toRecords, type CsvRecord } from "@/lib/csv/parse"
import {
  COURSE_TOTAL_HOURS,
  CURRICULUM_MASTERS,
  MAX_PATTERN_DAYS,
  MIN_PATTERN_DAYS,
  type CurriculumCsv,
  type MasterKey,
  type MasterResult,
} from "./masters"

/** 一度に INSERT する行数。講義コマは1,716件あるため分割する。 */
const CHUNK_SIZE = 500

/**
 * 複合キーと突き合わせ用の文字列をつなぐ区切り。
 * データに現れない制御文字を使う。区切りなしでつなぐと
 * ("gen", "01") と ("ge", "n01") が同じ文字列になる。
 */
const SEP = "\u0001"

// ---------------------------------------------------------------------------
// 列の読み取り
// ---------------------------------------------------------------------------

/** CSV の行番号。見出しが1行目なので、0起点の添字に2を足す。 */
const lineOf = (index: number) => index + 2

const required = (record: CsvRecord, column: string, index: number) => {
  const value = record[column]?.trim() ?? ""
  if (value === "") throw new Error(`${lineOf(index)} 行目の「${column}」が空です。`)
  return value
}

const optional = (record: CsvRecord, column: string) => {
  const value = record[column]?.trim() ?? ""
  return value === "" ? null : value
}

const integer = (record: CsvRecord, column: string, index: number) => {
  const value = required(record, column, index)
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${lineOf(index)} 行目の「${column}」が整数ではありません（${value}）。`)
  }
  return parsed
}

/** 所要時間は0.5時間単位（5.7）。 */
const halfHours = (record: CsvRecord, column: string, index: number) => {
  const value = required(record, column, index)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || (parsed * 2) % 1 !== 0) {
    throw new Error(`${lineOf(index)} 行目の「${column}」が0.5時間単位ではありません（${value}）。`)
  }
  return parsed
}

const assertUniqueKeys = (keys: string[], label: string) => {
  const seen = new Set<string>()
  for (const [index, key] of keys.entries()) {
    if (seen.has(key)) {
      throw new Error(`${lineOf(index)} 行目の${label}が重複しています。`)
    }
    seen.add(key)
  }
}

// ---------------------------------------------------------------------------
// 既存行との突き合わせ
// ---------------------------------------------------------------------------

/**
 * 行の中身を1つの文字列にまとめる。
 *
 * 既存行と1列ずつ比べる代わりにこれを比べ、変わっていない行は更新しない。
 * 取り込みのたびに全行を更新すると、更新日時だけが動いて差分が追えなくなる。
 */
const digest = (...parts: (string | number | null)[]) => parts.map((p) => p ?? "").join(SEP)

const chunk = <T>(rows: T[]): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE))
  return chunks
}

type Incoming<T> = { key: string; digest: string; values: T }

/** 追加する行と、中身が変わった行に振り分ける。 */
const split = <T>(incoming: Incoming<T>[], existing: Map<string, string>) => {
  const inserts: T[] = []
  const updates: Incoming<T>[] = []
  let unchanged = 0

  for (const row of incoming) {
    const current = existing.get(row.key)
    if (current === undefined) inserts.push(row.values)
    else if (current !== row.digest) updates.push(row)
    else unchanged++
  }
  return { inserts, updates, unchanged }
}

// ---------------------------------------------------------------------------
// マスタごとの取り込み
// ---------------------------------------------------------------------------

/** `db.transaction` が渡してくる接続。マスタ間で同じトランザクションを使い回す。 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type Counts = { inserted: number; updated: number; unchanged: number }

const importPrograms = async (tx: Tx, text: string, at: Date): Promise<Counts> => {
  const records = toRecords(parseCsv(text), CURRICULUM_MASTERS.programs.header)

  const incoming = records.map((record, index) => {
    const values = {
      code: required(record, "研修プログラムコード", index),
      name: required(record, "研修プログラム名", index),
      stage: required(record, "段階", index),
      displayOrder: integer(record, "表示順", index),
    }
    return {
      key: values.code,
      digest: digest(values.name, values.stage, values.displayOrder),
      values,
    }
  })
  assertUniqueKeys(
    incoming.map((row) => row.key),
    "研修プログラムコード",
  )

  const existing = new Map(
    (await tx.select().from(trainingPrograms)).map((row) => [
      row.code,
      digest(row.name, row.stage, row.displayOrder),
    ]),
  )
  const { inserts, updates, unchanged } = split(incoming, existing)

  for (const rows of chunk(inserts)) {
    await tx
      .insert(trainingPrograms)
      .values(rows.map((row) => ({ ...row, createdAt: at, updatedAt: at })))
  }
  for (const row of updates) {
    await tx
      .update(trainingPrograms)
      .set({ ...row.values, updatedAt: at })
      .where(eq(trainingPrograms.code, row.values.code))
  }

  return { inserted: inserts.length, updated: updates.length, unchanged }
}

const importCategories = async (tx: Tx, text: string, at: Date): Promise<Counts> => {
  const records = toRecords(parseCsv(text), CURRICULUM_MASTERS.categories.header)

  const incoming = records.map((record, index) => {
    const values = {
      code: required(record, "職種カテゴリコード", index),
      name: required(record, "職種カテゴリ名", index),
      displayOrder: integer(record, "表示順", index),
    }
    return { key: values.code, digest: digest(values.name, values.displayOrder), values }
  })
  assertUniqueKeys(
    incoming.map((row) => row.key),
    "職種カテゴリコード",
  )

  const existing = new Map(
    (await tx.select().from(jobCategories)).map((row) => [
      row.code,
      digest(row.name, row.displayOrder),
    ]),
  )
  const { inserts, updates, unchanged } = split(incoming, existing)

  for (const rows of chunk(inserts)) {
    await tx
      .insert(jobCategories)
      .values(rows.map((row) => ({ ...row, createdAt: at, updatedAt: at })))
  }
  for (const row of updates) {
    await tx
      .update(jobCategories)
      .set({ ...row.values, updatedAt: at })
      .where(eq(jobCategories.code, row.values.code))
  }

  return { inserted: inserts.length, updated: updates.length, unchanged }
}

/** コースは (研修プログラムコード, コース番号) で識別する。CSV の識別キーと同じ。 */
const courseKey = (programCode: string, courseNumber: string) =>
  `${programCode}${SEP}${courseNumber}`

const importCourses = async (tx: Tx, text: string, at: Date): Promise<Counts> => {
  const records = toRecords(parseCsv(text), CURRICULUM_MASTERS.courses.header)

  // 参照先はこのトランザクションで先に取り込み済み。DB を見れば、
  // 同じ CSV に入っているか既に登録済みかを区別せずに済む
  const programCodes = new Set(
    (await tx.select({ code: trainingPrograms.code }).from(trainingPrograms)).map((r) => r.code),
  )
  const categoryCodes = new Set(
    (await tx.select({ code: jobCategories.code }).from(jobCategories)).map((r) => r.code),
  )

  const incoming = records.map((record, index) => {
    const values = {
      programCode: required(record, "研修プログラムコード", index),
      categoryCode: required(record, "職種カテゴリコード", index),
      courseNumber: required(record, "コース番号", index),
      jobName: required(record, "職種名", index),
      purpose: required(record, "目的", index),
      displayOrder: integer(record, "表示順", index),
    }
    if (!programCodes.has(values.programCode)) {
      throw new Error(
        `${lineOf(index)} 行目の研修プログラムコード「${values.programCode}」が登録されていません。`,
      )
    }
    if (!categoryCodes.has(values.categoryCode)) {
      throw new Error(
        `${lineOf(index)} 行目の職種カテゴリコード「${values.categoryCode}」が登録されていません。`,
      )
    }
    return {
      key: courseKey(values.programCode, values.courseNumber),
      digest: digest(values.categoryCode, values.jobName, values.purpose, values.displayOrder),
      values,
    }
  })
  assertUniqueKeys(
    incoming.map((row) => row.key),
    "研修プログラムコードとコース番号の組み合わせ",
  )

  const existing = new Map(
    (await tx.select().from(courses)).map((row) => [
      courseKey(row.programCode, row.courseNumber),
      digest(row.categoryCode, row.jobName, row.purpose, row.displayOrder),
    ]),
  )
  const { inserts, updates, unchanged } = split(incoming, existing)

  for (const rows of chunk(inserts)) {
    await tx.insert(courses).values(rows.map((row) => ({ ...row, createdAt: at, updatedAt: at })))
  }
  for (const row of updates) {
    await tx
      .update(courses)
      .set({ ...row.values, updatedAt: at })
      .where(
        and(
          eq(courses.programCode, row.values.programCode),
          eq(courses.courseNumber, row.values.courseNumber),
        ),
      )
  }

  return { inserted: inserts.length, updated: updates.length, unchanged }
}

const importSessions = async (tx: Tx, text: string, at: Date): Promise<Counts> => {
  const records = toRecords(parseCsv(text), CURRICULUM_MASTERS.sessions.header)

  // 講義コマはコースの id を持つ。CSV はコース番号で指すので、ここで引き当てる
  const courseIds = new Map(
    (
      await tx
        .select({
          id: courses.id,
          programCode: courses.programCode,
          courseNumber: courses.courseNumber,
        })
        .from(courses)
    ).map((row) => [courseKey(row.programCode, row.courseNumber), row.id]),
  )

  const incoming = records.map((record, index) => {
    const programCode = required(record, "研修プログラムコード", index)
    const courseNumber = required(record, "コース番号", index)
    const courseId = courseIds.get(courseKey(programCode, courseNumber))
    if (courseId === undefined) {
      throw new Error(
        `${lineOf(index)} 行目のコース「${programCode} / ${courseNumber}」が登録されていません。`,
      )
    }

    const values = {
      courseId,
      sessionSymbol: required(record, "コマ記号", index),
      displayOrder: integer(record, "表示順", index),
      durationHours: halfHours(record, "所要時間", index).toFixed(1),
      title: required(record, "タイトル", index),
      description: optional(record, "説明"),
    }
    return {
      key: `${courseId}${SEP}${values.sessionSymbol}`,
      digest: digest(values.displayOrder, values.durationHours, values.title, values.description),
      values,
    }
  })
  assertUniqueKeys(
    incoming.map((row) => row.key),
    "コースとコマ記号の組み合わせ",
  )

  assertCourseComposition(incoming)

  const existing = new Map(
    (await tx.select().from(courseSessions)).map((row) => [
      `${row.courseId}${SEP}${row.sessionSymbol}`,
      digest(row.displayOrder, row.durationHours, row.title, row.description),
    ]),
  )
  const { inserts, updates, unchanged } = split(incoming, existing)

  for (const rows of chunk(inserts)) {
    await tx
      .insert(courseSessions)
      .values(rows.map((row) => ({ ...row, createdAt: at, updatedAt: at })))
  }
  for (const row of updates) {
    await tx
      .update(courseSessions)
      .set({ ...row.values, updatedAt: at })
      .where(
        and(
          eq(courseSessions.courseId, row.values.courseId),
          eq(courseSessions.sessionSymbol, row.values.sessionSymbol),
        ),
      )
  }

  return { inserted: inserts.length, updated: updates.length, unchanged }
}

/**
 * 1コースの所要時間の合計が10時間であることを確かめる（5.7）。
 *
 * DB の制約では表せない。コマ数は可変なので件数は見ないが、合計時間はコースの前提で、
 * ここが崩れると助成の対象にならない講義ができてしまう。
 */
const assertCourseComposition = (
  incoming: { values: { courseId: number; sessionSymbol: string; durationHours: string } }[],
) => {
  const byCourse = new Map<number, number>()
  for (const { values } of incoming) {
    byCourse.set(values.courseId, (byCourse.get(values.courseId) ?? 0) + Number(values.durationHours))
  }

  for (const [courseId, hours] of byCourse) {
    if (hours !== COURSE_TOTAL_HOURS) {
      throw new Error(
        `コース id=${courseId} の所要時間の合計が ${hours} 時間です。` +
          `${COURSE_TOTAL_HOURS} 時間必要です。`,
      )
    }
  }
}

const importPatterns = async (tx: Tx, text: string, at: Date): Promise<Counts> => {
  const records = toRecords(parseCsv(text), CURRICULUM_MASTERS.patterns.header)

  const incoming = records.map((record, index) => {
    const days = integer(record, "受講日数", index)
    if (days < MIN_PATTERN_DAYS || days > MAX_PATTERN_DAYS) {
      throw new Error(
        `${lineOf(index)} 行目の受講日数が ${days} です。${MIN_PATTERN_DAYS}〜${MAX_PATTERN_DAYS} の範囲で指定します。`,
      )
    }
    const values = {
      code: required(record, "開催パターンコード", index),
      name: required(record, "開催パターン名", index),
      days,
      timeBreakdown: required(record, "時間内訳", index),
      displayOrder: integer(record, "表示順", index),
    }
    return {
      key: values.code,
      digest: digest(values.name, values.days, values.timeBreakdown, values.displayOrder),
      values,
    }
  })
  assertUniqueKeys(
    incoming.map((row) => row.key),
    "開催パターンコード",
  )

  const existing = new Map(
    (await tx.select().from(sessionPatterns)).map((row) => [
      row.code,
      digest(row.name, row.days, row.timeBreakdown, row.displayOrder),
    ]),
  )
  const { inserts, updates, unchanged } = split(incoming, existing)

  for (const rows of chunk(inserts)) {
    await tx
      .insert(sessionPatterns)
      .values(rows.map((row) => ({ ...row, createdAt: at, updatedAt: at })))
  }
  for (const row of updates) {
    await tx
      .update(sessionPatterns)
      .set({ ...row.values, updatedAt: at })
      .where(eq(sessionPatterns.code, row.values.code))
  }

  return { inserted: inserts.length, updated: updates.length, unchanged }
}

/**
 * 日別コマ割当（5.7）。
 *
 * 割当はコースごとに持つが、CSV は「コマ記号ごとに何日目か」だけを書いた雛形で、
 * 取り込みのときに全コースへ展開する。初期データは132コースとも同じ構成のため、
 * 6,864行の CSV を用意しても中身は同じものの繰り返しになる。
 *
 * すでに割当があるコースには触れない。画面で日程を調整したコースが、
 * 再取り込みで雛形どおりに戻ってしまうのを避けるため。
 */
const importPatternDays = async (tx: Tx, text: string, at: Date): Promise<Counts> => {
  const records = toRecords(parseCsv(text), CURRICULUM_MASTERS.patternDays.header)

  const patterns = new Map(
    (await tx.select().from(sessionPatterns)).map((row) => [row.code, row.days]),
  )
  const sessions = await tx
    .select({
      id: courseSessions.id,
      courseId: courseSessions.courseId,
      sessionSymbol: courseSessions.sessionSymbol,
      displayOrder: courseSessions.displayOrder,
    })
    .from(courseSessions)
  const knownSymbols = new Set(sessions.map((row) => row.sessionSymbol))

  const template = records.map((record, index) => {
    const values = {
      patternCode: required(record, "開催パターンコード", index),
      dayNumber: integer(record, "日目", index),
      sessionSymbol: required(record, "コマ記号", index),
      displayOrder: integer(record, "表示順", index),
    }

    const days = patterns.get(values.patternCode)
    if (days === undefined) {
      throw new Error(
        `${lineOf(index)} 行目の開催パターンコード「${values.patternCode}」が登録されていません。`,
      )
    }
    if (values.dayNumber < 1 || values.dayNumber > days) {
      throw new Error(
        `${lineOf(index)} 行目の日目が ${values.dayNumber} です。` +
          `「${values.patternCode}」は ${days} 日間です。`,
      )
    }
    if (knownSymbols.size > 0 && !knownSymbols.has(values.sessionSymbol)) {
      throw new Error(
        `${lineOf(index)} 行目のコマ記号「${values.sessionSymbol}」が講義コマにありません。`,
      )
    }
    return values
  })
  assertUniqueKeys(
    template.map((row) => `${row.patternCode}${SEP}${row.sessionSymbol}`),
    "開催パターンとコマ記号の組み合わせ",
  )

  // すでに割当を持つ（パターン, コース）の組み合わせ。ここは触らない
  const assigned = new Map<string, number>()
  for (const row of await tx
    .select({ patternCode: patternDaySessions.patternCode, courseId: courseSessions.courseId })
    .from(patternDaySessions)
    .innerJoin(courseSessions, eq(courseSessions.id, patternDaySessions.courseSessionId))) {
    const key = `${row.patternCode}${SEP}${row.courseId}`
    assigned.set(key, (assigned.get(key) ?? 0) + 1)
  }

  const byCourse = new Map<number, typeof sessions>()
  for (const session of sessions) {
    byCourse.set(session.courseId, [...(byCourse.get(session.courseId) ?? []), session])
  }

  const dayOf = new Map<string, { dayNumber: number; displayOrder: number }>()
  for (const row of template) {
    dayOf.set(`${row.patternCode}${SEP}${row.sessionSymbol}`, {
      dayNumber: row.dayNumber,
      displayOrder: row.displayOrder,
    })
  }

  const inserts: {
    patternCode: string
    courseSessionId: number
    dayNumber: number
    displayOrder: number
  }[] = []
  let unchanged = 0

  for (const patternCode of new Set(template.map((row) => row.patternCode))) {
    for (const [courseId, courseSessionRows] of byCourse) {
      const existing = assigned.get(`${patternCode}${SEP}${courseId}`)
      if (existing) {
        unchanged += existing
        continue
      }
      for (const session of courseSessionRows) {
        // 雛形に無い記号は初日に置く。日の決まらないコマを残さない
        const day = dayOf.get(`${patternCode}${SEP}${session.sessionSymbol}`)
        inserts.push({
          patternCode,
          courseSessionId: session.id,
          dayNumber: day?.dayNumber ?? 1,
          displayOrder: day?.displayOrder ?? session.displayOrder,
        })
      }
    }
  }

  for (const rows of chunk(inserts)) {
    await tx
      .insert(patternDaySessions)
      .values(rows.map((row) => ({ ...row, createdAt: at, updatedAt: at })))
  }

  return { inserted: inserts.length, updated: 0, unchanged }
}

// ---------------------------------------------------------------------------

const IMPORTERS: Record<MasterKey, (tx: Tx, text: string, at: Date) => Promise<Counts>> = {
  programs: importPrograms,
  categories: importCategories,
  courses: importCourses,
  sessions: importSessions,
  patterns: importPatterns,
  patternDays: importPatternDays,
}

/**
 * 与えられた CSV を依存順に取り込む。
 *
 * 全体を1つのトランザクションで囲む。途中で失敗したときに、
 * コースだけ新しく講義コマは古い、という噛み合わない状態を残さないため。
 */
export const importCurriculum = async (files: CurriculumCsv): Promise<MasterResult[]> => {
  const at = new Date()

  return db.transaction(async (tx) => {
    const results: MasterResult[] = []
    for (const key of Object.keys(CURRICULUM_MASTERS) as MasterKey[]) {
      const text = files[key]
      if (text === undefined) continue

      try {
        const counts = await IMPORTERS[key](tx, text, at)
        results.push({ key, label: CURRICULUM_MASTERS[key].label, ...counts })
      } catch (error) {
        // どのマスタで落ちたか分からないと、どの CSV を直せばよいか判断できない
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`${CURRICULUM_MASTERS[key].label}: ${message}`)
      }
    }
    return results
  })
}
