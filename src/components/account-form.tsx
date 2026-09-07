"use client"

import { useActionState } from "react"
import { AccountCreated } from "@/components/account-created"
import { CheckboxGroup, ErrorList, Field, SubmitButton } from "@/components/form"
import { createAccountAction } from "@/lib/accounts/actions"
import { EMPTY_ACCOUNT_STATE } from "@/lib/accounts/state"
import { LOGIN_ID_RULE } from "@/lib/auth/policy"

/**
 * G-02 アカウントの作成（5.4）。
 * クライアントは所属会社が決まるため、会社詳細（D-02）から作成する。
 */
export function AccountForm({
  roleOptions,
}: {
  roleOptions: readonly { value: string; label: string }[]
}) {
  const [state, formAction] = useActionState(createAccountAction, EMPTY_ACCOUNT_STATE)
  const e = (name: string) => state.fieldErrors?.[name]
  const submitted = state.values as
    | { loginId: string; displayName: string; roles: string[] }
    | undefined

  if (state.created) {
    return (
      <AccountCreated
        created={state.created}
        backHref="/accounts"
        backLabel="アカウント一覧へ"
        againHref="/accounts/new"
      />
    )
  }

  return (
    <form
      key={state.attempt ?? 0}
      action={formAction}
      noValidate
      className="flex flex-col gap-6"
    >
      <ErrorList errors={state.errors} />

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field
          label="ログインID"
          name="loginId"
          required
          autoComplete="off"
          hint={`${LOGIN_ID_RULE}。大文字と小文字は区別します`}
          defaultValue={submitted?.loginId}
          errors={e("loginId")}
        />
        <Field
          label="利用者名"
          name="displayName"
          required
          defaultValue={submitted?.displayName}
          errors={e("displayName")}
        />
        <CheckboxGroup
          label="権限"
          name="roles"
          required
          options={roleOptions}
          defaultValues={submitted?.roles}
          errors={e("roles")}
        />
        <p className="text-xs text-slate-500">
          事務員兼講師のように複数を設定できます。作成後の変更はまだ実装していません。
        </p>
      </section>

      <div className="sm:max-w-xs">
        <SubmitButton>作成して仮パスワードを発行</SubmitButton>
      </div>
    </form>
  )
}
