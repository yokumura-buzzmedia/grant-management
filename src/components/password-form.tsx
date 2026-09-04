"use client"

import { useActionState } from "react"
import { ErrorList, Field, SubmitButton } from "@/components/form"
import { EMPTY_STATE, type FormState } from "@/lib/auth/form-state"
import { PASSWORD_RULES } from "@/lib/auth/policy"

/** A-02 初回設定と A-03 変更で共有する。どちらも現在のパスワードは求めない（5.4）。 */
export function PasswordForm({
  action,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <ErrorList errors={state.errors} />

      <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        <p className="mb-1 font-medium">パスワードの条件</p>
        <ul className="list-inside list-disc space-y-0.5">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.label}>{rule.label}</li>
          ))}
          <li>半角記号の使用は任意です</li>
        </ul>
      </div>

      <Field label="新しいパスワード" name="password" type="password" autoComplete="new-password" />
      <Field
        label="新しいパスワード（確認用）"
        name="confirmation"
        type="password"
        autoComplete="new-password"
      />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
