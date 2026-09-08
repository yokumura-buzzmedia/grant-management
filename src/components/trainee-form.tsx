"use client"

import { useActionState } from "react"
import { EMPLOYMENT_TYPES, GENDERS } from "@/db/schema"
import { ErrorList, Field, SelectField, SubmitButton } from "@/components/form"
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS } from "@/lib/trainees/labels"
import { EMPTY_TRAINEE_STATE, type TraineeFormState, type TraineeValues } from "@/lib/trainees/state"

const EMPLOYMENT_TYPE_OPTIONS = EMPLOYMENT_TYPES.map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABELS[value],
}))

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))

/**
 * D-03 受講者の登録・編集（5.6）。登録と編集で同じ項目を使う。
 *
 * 所属会社は開いている会社に固定し、画面から選ばせない。
 * 受講者は1社にだけ属し、会社をまたいで付け替えるものではないため。
 */
export function TraineeForm({
  action,
  values,
  submitLabel,
  framed = true,
}: {
  action: (prev: TraineeFormState, formData: FormData) => Promise<TraineeFormState>
  /** 編集時の現在値。登録時は渡さない */
  values?: TraineeValues
  submitLabel: string
  /** 枠を持つカードとして出すか。既に枠の中に置く場合は false */
  framed?: boolean
}) {
  const [state, formAction] = useActionState(action, EMPTY_TRAINEE_STATE)
  const e = (name: string) => state.fieldErrors?.[name]
  // 検証エラーで戻ったときは送信値を優先する。現在値に巻き戻すと入力が消える
  const v = (name: keyof TraineeValues) => state.values?.[name] ?? values?.[name] ?? ""

  return (
    <form key={state.attempt ?? 0} action={formAction} noValidate className="flex flex-col gap-6">
      <ErrorList errors={state.errors} />

      <section
        className={
          framed
            ? "flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
            : "flex flex-col gap-4"
        }
      >
        <Field label="氏名" name="name" required defaultValue={v("name")} errors={e("name")} />
        <Field
          label="フリガナ"
          name="nameKana"
          required
          hint="全角カタカナ"
          defaultValue={v("nameKana")}
          errors={e("nameKana")}
        />
        <Field
          label="雇用保険被保険者番号"
          name="insuranceNumber"
          required
          inputMode="numeric"
          hint="ハイフンなしの半角数字11桁。同じ会社の中では重複できません"
          defaultValue={v("insuranceNumber")}
          errors={e("insuranceNumber")}
        />
        <SelectField
          label="雇用形態"
          name="employmentType"
          required
          options={EMPLOYMENT_TYPE_OPTIONS}
          defaultValue={v("employmentType")}
          errors={e("employmentType")}
        />
        <Field
          label="職種"
          name="jobType"
          required
          hint="自由入力。研修コースの職種カテゴリとは別のものです"
          defaultValue={v("jobType")}
          errors={e("jobType")}
        />
        <Field
          label="職務内容"
          name="jobDescription"
          required
          defaultValue={v("jobDescription")}
          errors={e("jobDescription")}
        />
        <SelectField
          label="性別"
          name="gender"
          required
          options={GENDER_OPTIONS}
          defaultValue={v("gender")}
          errors={e("gender")}
        />

        {/* 入力欄と同じ枠の中に置く。外に出すと、どのフォームの保存か視線でつながらない */}
        <div>
          <SubmitButton fullWidth={false}>{submitLabel}</SubmitButton>
        </div>
      </section>
    </form>
  )
}
