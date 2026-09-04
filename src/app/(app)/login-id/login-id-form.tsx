"use client"

import { useActionState } from "react"
import { ErrorList, Field, SubmitButton } from "@/components/form"
import { changeLoginIdAction } from "@/lib/auth/actions"
import { EMPTY_STATE } from "@/lib/auth/form-state"
import { LOGIN_ID_RULE } from "@/lib/auth/policy"

export function LoginIdForm() {
  const [state, action] = useActionState(changeLoginIdAction, EMPTY_STATE)

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <ErrorList errors={state.errors} />
      <Field
        label="新しいログインID"
        name="loginId"
        autoComplete="username"
        hint={`${LOGIN_ID_RULE}。大文字と小文字は区別します`}
      />
      <Field
        label="現在のパスワード"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <SubmitButton>変更する</SubmitButton>
    </form>
  )
}
