"use client"

import { useActionState, useState } from "react"
import {
  ErrorList,
  Field,
  ReadOnlyField,
  SelectField,
  SubmitButton,
  TextAreaField,
} from "@/components/form"
import { buttonGhost, buttonSecondary, controlClass } from "@/components/ui"
import { EMPTY_STATE, type FormState } from "@/lib/auth/form-state"
import { COURSE_TOTAL_HOURS } from "@/lib/curriculum/masters"

/**
 * カリキュラムマスタの入力フォーム（01_要件定義.md 5.7）。
 *
 * どのマスタも項目が少ないので1ファイルにまとめている。
 * コードは登録後に変更しないため、編集のときは読み取り専用で出す。
 */

type Action = (prev: FormState, formData: FormData) => Promise<FormState>

/** 検証エラーで戻ってきたときは送信値を初期値に戻す。 */
const restore = (state: FormState, fallback: string | number | null | undefined, name: string) =>
  state.values ? ((state.values[name] as string | undefined) ?? "") : String(fallback ?? "")

const CODE_HINT = "登録後は変更できません。半角英数字・ハイフン・アンダースコア。"

// ---------------------------------------------------------------------------

export function ProgramForm({
  action,
  values,
  submitLabel,
}: {
  action: Action
  values?: {
    code: string
    name: string
    stage: string
    displayOrder: number
  }
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const e = (name: string) => state.fieldErrors?.[name]

  return (
    <form action={formAction} key={state.attempt} className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />
      {values ? (
        <ReadOnlyField label="研修プログラムコード" value={values.code} hint={CODE_HINT} />
      ) : (
        <Field
          label="研修プログラムコード"
          name="code"
          required
          hint={CODE_HINT}
          defaultValue={restore(state, undefined, "code")}
          errors={e("code")}
        />
      )}
      <Field
        label="研修プログラム名"
        name="name"
        required
        defaultValue={restore(state, values?.name, "name")}
        errors={e("name")}
      />
      <Field
        label="段階"
        name="stage"
        required
        hint="例: 第1段階"
        defaultValue={restore(state, values?.stage, "stage")}
        errors={e("stage")}
      />
      <Field
        label="表示順"
        name="displayOrder"
        required
        inputMode="numeric"
        defaultValue={restore(state, values?.displayOrder ?? 1, "displayOrder")}
        errors={e("displayOrder")}
      />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------------

export function CategoryForm({
  action,
  values,
  submitLabel,
}: {
  action: Action
  values?: { code: string; name: string; displayOrder: number }
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const e = (name: string) => state.fieldErrors?.[name]

  return (
    <form action={formAction} key={state.attempt} className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />
      {values ? (
        <ReadOnlyField label="職種カテゴリコード" value={values.code} hint={CODE_HINT} />
      ) : (
        <Field
          label="職種カテゴリコード"
          name="code"
          required
          hint={CODE_HINT}
          defaultValue={restore(state, undefined, "code")}
          errors={e("code")}
        />
      )}
      <Field
        label="職種カテゴリ名"
        name="name"
        required
        defaultValue={restore(state, values?.name, "name")}
        errors={e("name")}
      />
      <Field
        label="表示順"
        name="displayOrder"
        required
        inputMode="numeric"
        defaultValue={restore(state, values?.displayOrder ?? 1, "displayOrder")}
        errors={e("displayOrder")}
      />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------------

export function CourseForm({
  action,
  categories,
  program,
  symbols,
  values,
  submitLabel,
}: {
  action: Action
  categories: { value: string; label: string }[]
  /** 追加のときだけ使う。コースは研修プログラムに属し、あとから移さない */
  program?: { code: string; name: string }
  /**
   * 追加のときの初期のコマ記号。
   * いま開いているコースの記号を渡し、入力の手掛かりにする。記号は自由に変えられる
   */
  symbols?: string[]
  values?: {
    programName: string
    courseNumber: string
    categoryCode: string
    jobName: string
    purpose: string
    displayOrder: number
  }
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const e = (name: string) => state.fieldErrors?.[name]

  return (
    <form action={formAction} key={state.attempt} className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />

      {values ? (
        <>
          <ReadOnlyField
            label="研修プログラム"
            value={values.programName}
            hint="コースの所属は登録後に変更できません。"
          />
          <ReadOnlyField label="コース番号" value={values.courseNumber} hint={CODE_HINT} />
        </>
      ) : (
        <>
          <input type="hidden" name="programCode" value={program?.code ?? ""} />
          <ReadOnlyField
            label="研修プログラム"
            value={program?.name ?? ""}
            hint="いま選んでいる研修プログラムに追加します。"
          />
          <Field
            label="コース番号"
            name="courseNumber"
            required
            hint="研修プログラムの中で一意にします。例: 67"
            defaultValue={restore(state, undefined, "courseNumber")}
            errors={e("courseNumber")}
          />
        </>
      )}

      <SelectField
        label="職種カテゴリ"
        name="categoryCode"
        required
        options={categories}
        defaultValue={restore(state, values?.categoryCode, "categoryCode")}
        errors={e("categoryCode")}
      />
      <Field
        label="職種名"
        name="jobName"
        required
        defaultValue={restore(state, values?.jobName, "jobName")}
        errors={e("jobName")}
      />
      <TextAreaField
        label="目的"
        name="purpose"
        required
        rows={8}
        hint="改行はそのまま保存します。文字装飾は保持しません。"
        defaultValue={restore(state, values?.purpose, "purpose")}
        errors={e("purpose")}
      />
      <Field
        label="表示順"
        name="displayOrder"
        required
        inputMode="numeric"
        defaultValue={restore(state, values?.displayOrder ?? 1, "displayOrder")}
        errors={e("displayOrder")}
      />

      {values ? null : <SessionRows state={state} symbols={symbols ?? []} />}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------------

type SessionRow = { symbol: string; title: string; hours: string; description: string }

const emptyRow = (): SessionRow => ({ symbol: "", title: "", hours: "", description: "" })

/** 検証エラーで戻ってきたら、送信した行数と値をそのまま復元する。 */
const initialRows = (state: FormState, symbols: string[]): SessionRow[] => {
  if (state.values) {
    const rows: SessionRow[] = []
    for (let index = 0; state.values[`session${index}Title`] !== undefined; index += 1) {
      rows.push({
        symbol: String(state.values[`session${index}Symbol`] ?? ""),
        title: String(state.values[`session${index}Title`] ?? ""),
        hours: String(state.values[`session${index}Hours`] ?? ""),
        description: String(state.values[`session${index}Description`] ?? ""),
      })
    }
    if (rows.length > 0) return rows
  }
  if (symbols.length > 0) return symbols.map((symbol) => ({ ...emptyRow(), symbol }))
  return [emptyRow()]
}

/**
 * コース追加のときの講義コマ（5.7）。
 *
 * コマ数は可変。日別コマ割当はコースごとに持つので、記号も件数も他のコースに合わせなくてよい。
 * ただしコース内では記号が重複しないようにする。
 *
 * 合計時間はその場で出す。10時間ちょうどでないと保存できないため、
 * 送信してから気づくと全コマを見直すことになる。
 */
function SessionRows({ state, symbols }: { state: FormState; symbols: string[] }) {
  const [rows, setRows] = useState(() => initialRows(state, symbols))
  const total = rows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0)
  const matched = total === COURSE_TOTAL_HOURS

  const change = (index: number, key: keyof SessionRow, value: string) =>
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, [key]: value } : row)),
    )

  const errorsOf = (index: number) =>
    ["Symbol", "Title", "Hours", "Description"].flatMap(
      (suffix) => state.fieldErrors?.[`session${index}${suffix}`] ?? [],
    )

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-slate-700">
        講義コマ
        <span className="ml-1 text-red-600">
          <span aria-hidden>*</span>
          <span className="sr-only">必須</span>
        </span>
      </legend>
      <p className="text-xs leading-relaxed text-slate-600">
        コマ数は自由です。所要時間は0.5時間単位で、合計が{COURSE_TOTAL_HOURS}
        時間ちょうどになるようにします。コマ記号はこのコースの中で重複しないようにします。
      </p>

      <p
        role="status"
        className={
          matched
            ? "rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700"
            : "rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        }
      >
        {rows.length} コマ ／ 合計 {Number(total.toFixed(1))} 時間 ／ {COURSE_TOTAL_HOURS} 時間
      </p>

      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const errors = errorsOf(index)
          return (
            <li
              key={index}
              className={
                errors.length > 0
                  ? "flex flex-col gap-2 rounded-md border border-red-400 p-3"
                  : "flex flex-col gap-2 rounded-md border border-slate-200 p-3"
              }
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-24">
                  <span className="mb-1 block text-xs text-slate-500">コマ記号</span>
                  <input
                    name={`session${index}Symbol`}
                    aria-label={`${index + 1}コマ目のコマ記号`}
                    value={row.symbol}
                    onChange={(event) => change(index, "symbol", event.target.value)}
                    className={controlClass + " w-full font-mono"}
                  />
                </div>

                <div className="min-w-40 flex-1">
                  <span className="mb-1 block text-xs text-slate-500">タイトル</span>
                  <input
                    name={`session${index}Title`}
                    aria-label={`${index + 1}コマ目のタイトル`}
                    value={row.title}
                    onChange={(event) => change(index, "title", event.target.value)}
                    className={controlClass + " w-full"}
                  />
                </div>

                <div className="w-24">
                  <span className="mb-1 block text-xs text-slate-500">所要時間</span>
                  <input
                    name={`session${index}Hours`}
                    inputMode="numeric"
                    aria-label={`${index + 1}コマ目の所要時間`}
                    value={row.hours}
                    onChange={(event) => change(index, "hours", event.target.value)}
                    className={controlClass + " w-full"}
                  />
                </div>

                {/* コマのないコースは作れないので、1行のときは消せない */}
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  disabled={rows.length <= 1}
                  className={buttonGhost + " shrink-0 disabled:opacity-40"}
                >
                  削除
                  <span className="sr-only">（{index + 1}コマ目）</span>
                </button>
              </div>

              <div>
                <span className="mb-1 block text-xs text-slate-500">説明</span>
                <input
                  name={`session${index}Description`}
                  aria-label={`${index + 1}コマ目の説明`}
                  value={row.description}
                  onChange={(event) => change(index, "description", event.target.value)}
                  className={controlClass + " w-full"}
                />
              </div>

              {errors.length > 0 ? <p className="text-xs text-red-700">{errors.join(" ")}</p> : null}
            </li>
          )
        })}
      </ol>

      <div>
        <button
          type="button"
          onClick={() => setRows((current) => [...current, emptyRow()])}
          className={buttonSecondary}
        >
          コマを追加
        </button>
      </div>
    </fieldset>
  )
}

// ---------------------------------------------------------------------------

export function SessionForm({
  action,
  values,
  submitLabel,
}: {
  action: Action
  /** 追加のときは渡さない。コマ記号もそのときだけ入力する */
  values?: {
    sessionSymbol: string
    displayOrder: number
    durationHours: string
    title: string
    description: string | null
  }
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const e = (name: string) => state.fieldErrors?.[name]

  return (
    <form action={formAction} key={state.attempt} className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />
      {values ? (
        <ReadOnlyField
          label="コマ記号"
          value={values.sessionSymbol}
          hint="開催パターンの日別割当と対応するため、変更できません。"
        />
      ) : (
        <Field
          label="コマ記号"
          name="sessionSymbol"
          required
          hint="コースの中で重複しないようにします。"
          defaultValue={restore(state, undefined, "sessionSymbol")}
          errors={e("sessionSymbol")}
        />
      )}
      <Field
        label="タイトル"
        name="title"
        required
        defaultValue={restore(state, values?.title, "title")}
        errors={e("title")}
      />
      <TextAreaField
        label="説明"
        name="description"
        rows={4}
        defaultValue={restore(state, values?.description, "description")}
        errors={e("description")}
      />
      <Field
        label="所要時間"
        name="durationHours"
        required
        inputMode="numeric"
        hint={`0.5時間単位。コース全体の合計が${COURSE_TOTAL_HOURS}時間になるようにします。`}
        defaultValue={restore(state, values ? Number(values.durationHours) : undefined, "durationHours")}
        errors={e("durationHours")}
      />
      <Field
        label="表示順"
        name="displayOrder"
        required
        inputMode="numeric"
        defaultValue={restore(state, values?.displayOrder ?? 1, "displayOrder")}
        errors={e("displayOrder")}
      />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------------

export function PatternForm({
  action,
  values,
  submitLabel,
}: {
  action: Action
  values?: {
    code: string
    name: string
    days: number
    timeBreakdown: string
    displayOrder: number
  }
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const e = (name: string) => state.fieldErrors?.[name]

  return (
    <form action={formAction} key={state.attempt} className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />
      {values ? (
        <ReadOnlyField label="開催パターンコード" value={values.code} hint={CODE_HINT} />
      ) : (
        <Field
          label="開催パターンコード"
          name="code"
          required
          hint={CODE_HINT}
          defaultValue={restore(state, undefined, "code")}
          errors={e("code")}
        />
      )}
      <Field
        label="開催パターン名"
        name="name"
        required
        hint="例: 3日間コース"
        defaultValue={restore(state, values?.name, "name")}
        errors={e("name")}
      />
      <SelectField
        label="受講日数"
        name="days"
        required
        options={[2, 3, 4, 5].map((day) => ({ value: String(day), label: `${day} 日` }))}
        defaultValue={restore(state, values?.days, "days")}
        errors={e("days")}
      />
      <Field
        label="時間内訳"
        name="timeBreakdown"
        required
        hint="例: 3時間/3時間/4時間"
        defaultValue={restore(state, values?.timeBreakdown, "timeBreakdown")}
        errors={e("timeBreakdown")}
      />
      <Field
        label="表示順"
        name="displayOrder"
        required
        inputMode="numeric"
        defaultValue={restore(state, values?.displayOrder ?? 1, "displayOrder")}
        errors={e("displayOrder")}
      />

      {values ? null : (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          日別コマ割当は、全コースの講義コマを1日目に置いた状態で作ります。
          追加したあとに、コースごとに「日別コマ割当」から各コマの日を決めてください。
        </p>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------------

/**
 * 日別コマ割当（5.7）。
 * 割当はコースごとに持つので、ここで決まるのはいま開いているコースの日程だけ。
 * コマの増減はここではできない。講義コマの側で決まる。
 */
export function PatternDaysForm({
  action,
  days,
  rows,
  submitLabel,
}: {
  action: Action
  days: number
  rows: { id: number; sessionSymbol: string; dayNumber: number; title: string }[]
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  return (
    <form action={formAction} key={state.attempt} className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-mono text-sm font-medium text-slate-900">
              {row.sessionSymbol}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{row.title}</span>
            <label className="shrink-0">
              <span className="sr-only">{row.sessionSymbol} の日</span>
              <select
                name={`day_${row.id}`}
                defaultValue={String(row.dayNumber)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              >
                {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {day} 日目
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
