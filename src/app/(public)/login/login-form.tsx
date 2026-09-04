"use client"

import { useActionState } from "react"
import { ErrorList, Field, SubmitButton } from "@/components/form"
import { loginAction } from "@/lib/auth/actions"
import { EMPTY_STATE } from "@/lib/auth/form-state"

export function LoginForm() {
  const [state, action] = useActionState(loginAction, EMPTY_STATE)

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <ErrorList errors={state.errors} />
      <Field
        label="ログインID"
        name="loginId"
        autoComplete="username"
        hint="大文字と小文字を区別します"
      />
      <Field label="パスワード" name="password" type="password" autoComplete="current-password" />
      <SubmitButton>ログイン</SubmitButton>
    </form>
  )
}
