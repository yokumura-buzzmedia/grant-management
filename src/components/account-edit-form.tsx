"use client"

import { useActionState } from "react"
import { CheckboxGroup, ErrorList, Field, SubmitButton } from "@/components/form"
import { updateAccountAction } from "@/lib/accounts/actions"
import { EMPTY_ACCOUNT_STATE } from "@/lib/accounts/state"
import { LOGIN_ID_RULE } from "@/lib/auth/policy"

/** G-02 アカウントの編集（5.4）。 */
export function AccountEditForm({
  accountId,
  loginId,
  displayName,
  roles,
  roleOptions,
  fixedRoleLabels,
}: {
  accountId: number
  loginId: string
  displayName: string
  roles: string[]
  roleOptions: readonly { value: string; label: string }[]
  /** 画面から変更できない権限（クライアント・代理店） */
  fixedRoleLabels: string[]
}) {
  const action = updateAccountAction.bind(null, accountId)
  const [state, formAction] = useActionState(action, EMPTY_ACCOUNT_STATE)
  const e = (name: string) => state.fieldErrors?.[name]
  const submitted = state.values as
    | { loginId: string; displayName: string; roles: string[] }
    | undefined

  return (
    <form
      key={state.attempt ?? 0}
      action={formAction}
      noValidate
      className="flex flex-col gap-6"
    >
      <ErrorList errors={state.errors} />

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-bold text-slate-500">基本情報</h2>
        <Field
          label="ログインID"
          name="loginId"
          required
          autoComplete="off"
          hint={`${LOGIN_ID_RULE}。変更すると本人はログアウトされます`}
          defaultValue={submitted?.loginId ?? loginId}
          errors={e("loginId")}
        />
        <Field
          label="利用者名"
          name="displayName"
          required
          defaultValue={submitted?.displayName ?? displayName}
          errors={e("displayName")}
        />
        <CheckboxGroup
          label="権限"
          name="roles"
          required
          options={roleOptions}
          defaultValues={submitted?.roles ?? roles}
          errors={e("roles")}
        />
        {fixedRoleLabels.length > 0 ? (
          <p className="text-xs text-slate-500">
            {fixedRoleLabels.join("・")} の権限はこの画面では変更できません。所属会社や所属代理店と対になるためです。
          </p>
        ) : null}
        <p className="text-xs text-slate-500">
          権限の変更は保存後すぐに反映されます。本人の再ログインは必要ありません。
        </p>
      </section>

      <div className="sm:max-w-xs">
        <SubmitButton>保存する</SubmitButton>
      </div>
    </form>
  )
}
