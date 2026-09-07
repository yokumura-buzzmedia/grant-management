"use client"

import { useActionState } from "react"
import { AccountCreated } from "@/components/account-created"
import { ErrorList, Field, SubmitButton } from "@/components/form"
import { createClientAccountAction } from "@/lib/accounts/actions"
import { EMPTY_ACCOUNT_STATE } from "@/lib/accounts/state"
import { LOGIN_ID_RULE } from "@/lib/auth/policy"

/**
 * 会社詳細からのクライアントアカウント作成（5.3, 5.4）。
 * 所属会社は開いている会社に固定する。作成後は変更しない。
 */
export function ClientAccountForm({
  companyId,
  companyName,
}: {
  companyId: number
  companyName: string
}) {
  const action = createClientAccountAction.bind(null, companyId)
  const [state, formAction] = useActionState(action, EMPTY_ACCOUNT_STATE)
  const e = (name: string) => state.fieldErrors?.[name]
  const submitted = state.values as { loginId: string; displayName: string } | undefined

  if (state.created) {
    return (
      <AccountCreated
        created={state.created}
        backHref={`/companies/${companyId}?tab=accounts`}
        backLabel="会社情報へ"
        againHref={`/companies/${companyId}/accounts/new`}
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
        <p className="rounded-md bg-slate-100 p-3 text-xs leading-relaxed text-slate-600">
          所属会社は <span className="font-medium">{companyName}</span> になります。
          作成後に所属会社は変更できません。
        </p>
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
      </section>

      <div className="sm:max-w-xs">
        <SubmitButton>作成して仮パスワードを発行</SubmitButton>
      </div>
    </form>
  )
}
