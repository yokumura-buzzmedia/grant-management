"use client"

import { useActionState } from "react"
import { ErrorList, Field, ReadOnlyField, SelectField, SubmitButton } from "@/components/form"
import { EMPTY_STATE, type FormState } from "@/lib/auth/form-state"
import { updateProjectAction } from "@/lib/projects/actions"

/**
 * C-02 基本情報の編集（01_要件定義.md 5.16）。
 *
 * 変えられるのは案件名と主担当だけ。案件番号は自動発行、会社は登録後に変えない。
 * ステータスはここでは変えない（遷移条件が未確定のため）。
 */
export function ProjectEditForm({
  projectId,
  projectNumber,
  companyName,
  name,
  primaryStaffId,
  staff,
}: {
  projectId: number
  projectNumber: string
  companyName: string
  name: string
  primaryStaffId: number | null
  staff: readonly { value: string; label: string }[]
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateProjectAction.bind(null, projectId),
    EMPTY_STATE,
  )
  const e = (key: string) => state.fieldErrors?.[key]
  const restore = (key: string, fallback: string) =>
    state.values ? ((state.values[key] as string | undefined) ?? "") : fallback

  return (
    <form action={formAction} key={state.attempt} noValidate className="flex flex-col gap-4">
      <ErrorList errors={state.errors} />

      <ReadOnlyField
        label="案件番号"
        value={projectNumber}
        hint="作成時に自動で発行します。変更できません。"
      />
      <ReadOnlyField
        label="会社"
        value={companyName}
        hint="申請案件の所属は登録後に変更できません。"
      />
      <Field
        label="案件名"
        name="name"
        required
        defaultValue={restore("name", name)}
        errors={e("name")}
      />
      <SelectField
        label="主担当の事務員"
        name="primaryStaffId"
        required
        options={staff}
        defaultValue={restore("primaryStaffId", primaryStaffId ? String(primaryStaffId) : "")}
        errors={e("primaryStaffId")}
      />
      <SubmitButton>保存する</SubmitButton>
    </form>
  )
}
