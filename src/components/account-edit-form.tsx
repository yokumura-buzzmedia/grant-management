"use client"

import { useActionState } from "react"
import { CheckboxGroup, ErrorList, Field, ReadOnlyField, SubmitButton } from "@/components/form"
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
  companyName = null,
  returnCompanyId = null,
  framed = true,
}: {
  accountId: number
  loginId: string
  displayName: string
  roles: string[]
  /**
   * 画面から付け外しできる権限。
   * 空の場合は権限欄そのものを出さない。会社詳細のクライアントアカウントは
   * 権限がクライアントに固定で、この画面から変えるものがないため。
   */
  roleOptions: readonly { value: string; label: string }[]
  /** 画面から変更できない権限（クライアント・代理店） */
  fixedRoleLabels: string[]
  /** クライアントの所属会社。読み取り専用で出す。対象外なら null */
  companyName?: string | null
  /** 会社詳細から使う場合の会社ID。保存後にその画面へ戻す */
  returnCompanyId?: number | null
  /** 枠を持つカードとして出すか。既に枠の中に置く場合は false */
  framed?: boolean
}) {
  const action = updateAccountAction.bind(null, accountId, returnCompanyId)
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

      <section
        className={
          framed ? "flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6" : "flex flex-col gap-4"
        }
      >
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
        {companyName === null ? null : (
          <ReadOnlyField
            label="所属会社"
            value={companyName}
            hint="所属会社はクライアント権限と対になるため、この画面では変更できません"
          />
        )}
        {roleOptions.length > 0 ? (
          <>
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
          </>
        ) : null}

        {/* 入力欄と同じ枠の中に置く。外に出すと、どのフォームの保存か視線でつながらない */}
        <div>
          <SubmitButton fullWidth={false}>保存する</SubmitButton>
        </div>
      </section>
    </form>
  )
}
