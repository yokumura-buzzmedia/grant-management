"use client"

import { useActionState } from "react"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ErrorList } from "@/components/form"
import { regeneratePasswordAction } from "@/lib/accounts/actions"
import { EMPTY_ACCOUNT_STATE } from "@/lib/accounts/state"

/** 仮パスワードの再生成（5.4）。発行した値はこの画面でしか確認できない。 */
export function AccountPasswordReset({
  accountId,
  accountName,
  isTemporaryPassword,
  framed = true,
}: {
  accountId: number
  /** 確認ダイアログで対象を示すための表示名 */
  accountName: string
  /** 仮パスワードのまま。本人がまだ自分のパスワードを設定していない */
  isTemporaryPassword: boolean
  /** 枠を持つカードとして出すか。既に枠の中に置く場合は false */
  framed?: boolean
}) {
  const action = regeneratePasswordAction.bind(null, accountId)
  const [state, formAction] = useActionState(action, EMPTY_ACCOUNT_STATE)

  return (
    <section
      className={
        framed
          ? "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6"
          : "flex flex-col gap-3"
      }
    >
      <h2 className="text-sm font-bold text-slate-500">パスワード</h2>

      {/* 状態と同じ書き方にする。「現在」で始めると2つの行が読み比べやすい */}
      <p className="text-sm text-slate-700">
        現在{" "}
        {isTemporaryPassword ? (
          <>
            <span className="font-bold">仮パスワード</span>。本人はまだ自分のパスワードを
            設定していません。初回ログイン時に設定を求められます。
          </>
        ) : (
          "本人が設定済み"
        )}
      </p>

      {state.created ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">仮パスワードを再生成しました。</p>
          <p className="mt-2 font-mono text-lg font-bold">{state.created.temporaryPassword}</p>
          <p className="mt-2 text-xs leading-relaxed text-emerald-900">
            この画面でしか確認できません。メールまたはLINEで本人へ伝えてください。
          </p>
        </div>
      ) : null}

      <div>
        {/* 何が起きるかはダイアログが持つ。画面に出しっぱなしにすると読み飛ばされる */}
        <ConfirmDialog
          action={formAction}
          triggerLabel="仮パスワードを再生成"
          title="仮パスワードを再生成しますか"
          description={
            <>
              <span className="font-medium">{accountName}</span> の仮パスワードを作り直します。
            </>
          }
          consequences={[
            "そのアカウントでログイン中のすべての端末がログアウトします。",
            "本人は次のログインで新しいパスワードの設定を求められます。",
            "発行した値はこの画面でしか確認できません。",
          ]}
          confirmLabel="再生成する"
          // 発行のたびに値が変わる。結果は画面側に出すのでダイアログは閉じる
          closeToken={state.created?.temporaryPassword}
        >
          <ErrorList errors={state.errors} />
        </ConfirmDialog>
      </div>
    </section>
  )
}
