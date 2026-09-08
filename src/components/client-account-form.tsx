"use client"

import { useActionState, useState } from "react"
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
  framed = true,
}: {
  companyId: number
  companyName: string
  /** 枠を持つカードとして出すか。既に枠の中に置く場合は false */
  framed?: boolean
}) {
  // 作成結果は useActionState が持つため、続けて作成するには作り直すしかない
  const [round, setRound] = useState(0)
  return (
    <ClientAccountFormRound
      key={round}
      companyId={companyId}
      companyName={companyName}
      framed={framed}
      onAgain={() => setRound((current) => current + 1)}
    />
  )
}

function ClientAccountFormRound({
  companyId,
  companyName,
  framed,
  onAgain,
}: {
  companyId: number
  companyName: string
  framed: boolean
  onAgain: () => void
}) {
  const action = createClientAccountAction.bind(null, companyId)
  const [state, formAction] = useActionState(action, EMPTY_ACCOUNT_STATE)
  const e = (name: string) => state.fieldErrors?.[name]
  const submitted = state.values as { loginId: string; displayName: string } | undefined

  if (state.created) {
    return (
      // 会社詳細の中に置くため、画面を移らずその場で続けて作成できるようにする
      <AccountCreated created={state.created} onAgain={onAgain} />
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

      <section
        className={
          framed
            ? "flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
            : "flex flex-col gap-4"
        }
      >
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
