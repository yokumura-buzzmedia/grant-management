"use client"

import { useActionState } from "react"
import {
  ErrorList,
  Field,
  ReadOnlyField,
  SelectField,
  SubmitButton,
  TextAreaField,
} from "@/components/form"
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
  values,
  submitLabel,
}: {
  action: Action
  categories: { value: string; label: string }[]
  /** 追加のときだけ使う。コースは研修プログラムに属し、あとから移さない */
  program?: { code: string; name: string }
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

      {values ? null : (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          講義コマはここでは登録しません。コースを追加したあと、「講義コマを追加」から
          1コマずつ足してください。所要時間の合計が{COURSE_TOTAL_HOURS}時間になるようにします。
        </p>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}

// ---------------------------------------------------------------------------

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
    /** いま開いている開催パターンでの表示順。ドラッグで決まるので読み取り専用で出す */
    orderText: string
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
      {values ? (
        <ReadOnlyField
          label="表示順"
          value={values.orderText}
          hint="日程のカードをドラッグして決めます。開催パターンごとに別の並びを持ちます。"
        />
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          表示順は末尾に追加します。並びは、追加したあとに日程のカードをドラッグして決めてください。
        </p>
      )}
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
