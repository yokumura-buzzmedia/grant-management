"use client"

import { useActionState } from "react"
import { ErrorList, SubmitButton } from "@/components/form"
import { regeneratePasswordAction } from "@/lib/accounts/actions"
import { EMPTY_ACCOUNT_STATE } from "@/lib/accounts/state"

/** 仮パスワードの再生成（5.4）。発行した値はこの画面でしか確認できない。 */
export function AccountPasswordReset({ accountId }: { accountId: number }) {
  const action = regeneratePasswordAction.bind(null, accountId)
  const [state, formAction] = useActionState(action, EMPTY_ACCOUNT_STATE)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-bold text-slate-500">仮パスワードの再生成</h2>
      <ErrorList errors={state.errors} />

      {state.created ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">仮パスワードを再生成しました。</p>
          <p className="mt-2 font-mono text-lg font-bold">{state.created.temporaryPassword}</p>
          <p className="mt-2 text-xs leading-relaxed text-emerald-900">
            この画面でしか確認できません。メールまたはLINEで本人へ伝えてください。
            本人は次のログインで新しいパスワードの設定を求められます。
          </p>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-slate-500">
        再生成すると、そのアカウントでログイン中のすべての端末がログアウトします。
      </p>

      <form action={formAction} className="sm:max-w-xs">
        <SubmitButton>仮パスワードを再生成</SubmitButton>
      </form>
    </section>
  )
}
