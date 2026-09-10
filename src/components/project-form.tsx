"use client"

import { useActionState } from "react"
import { ErrorList, Field, SelectField, SubmitButton } from "@/components/form"
import { EMPTY_STATE, type FormState } from "@/lib/auth/form-state"
import { createProjectAction } from "@/lib/projects/actions"

/**
 * C-09 申請案件の作成（01_要件定義.md 5.15, 5.16）。
 *
 * ステータスは「営業中」で作られるので選ばせない。案件番号も自動発行のため入力しない。
 */
export function ProjectForm({
  companies,
  staff,
  defaultCompanyId,
}: {
  companies: readonly { value: string; label: string }[]
  staff: readonly { value: string; label: string }[]
  /** 会社詳細から来たときの初期選択。選び直せる */
  defaultCompanyId?: string
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createProjectAction, EMPTY_STATE)
  const e = (name: string) => state.fieldErrors?.[name]
  const restore = (name: string, fallback = "") =>
    state.values ? ((state.values[name] as string | undefined) ?? "") : fallback

  return (
    <form action={formAction} key={state.attempt} noValidate className="flex flex-col gap-6">
      <ErrorList errors={state.errors} />

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <SelectField
          label="会社"
          name="companyId"
          required
          options={companies}
          defaultValue={restore("companyId", defaultCompanyId ?? "")}
          errors={e("companyId")}
        />
        <Field
          label="案件名"
          name="name"
          required
          hint="案件番号とは別に、業務で呼ぶ名前を付けます。"
          defaultValue={restore("name")}
          errors={e("name")}
        />
        <SelectField
          label="主担当の事務員"
          name="primaryStaffId"
          required
          options={staff}
          defaultValue={restore("primaryStaffId")}
          errors={e("primaryStaffId")}
        />
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          案件番号は作成時に自動で発行します。ステータスは「営業中」で作られます。
        </p>
      </section>

      <SubmitButton>作成する</SubmitButton>
    </form>
  )
}
