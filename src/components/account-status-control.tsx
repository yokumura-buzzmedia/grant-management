"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { SubmitButton } from "@/components/form"
import { setAccountActiveAction } from "@/lib/accounts/actions"

/**
 * 有効・無効の切り替え（5.4）。
 *
 * 無効にすると全端末が直ちにログアウトするため、確認をとる。
 * 有効に戻すのは取り消しやすいので確認しない。確認を求める回数が増えるほど、
 * 本当に危険な確認まで読み飛ばされる。
 */
export function AccountStatusControl({
  accountId,
  accountName,
  isActive,
  disabledReason,
  returnCompanyId = null,
  framed = true,
}: {
  accountId: number
  /** 確認ダイアログで対象を示すための表示名 */
  accountName: string
  isActive: boolean
  /** 切り替えられない場合の理由。null なら操作できる */
  disabledReason: string | null
  /** 会社詳細から使う場合の会社ID。切り替え後にその画面へ戻す */
  returnCompanyId?: number | null
  /** 枠を持つカードとして出すか。既に枠の中に置く場合は false */
  framed?: boolean
}) {
  const action = setAccountActiveAction.bind(null, accountId, !isActive, returnCompanyId)

  return (
    <section
      className={
        framed
          ? "flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6"
          : "flex flex-col gap-3"
      }
    >
      <h2 className="text-sm font-bold text-slate-500">状態</h2>

      {disabledReason ? (
        <p className="rounded-md bg-slate-100 p-3 text-xs text-slate-600">{disabledReason}</p>
      ) : (
        <>
          <p className="text-sm text-slate-700">
            現在 {isActive ? "有効" : <span className="font-bold">無効</span>}
          </p>
          <div>
            {isActive ? (
              <ConfirmDialog
                action={action}
                triggerLabel="無効にする"
                title="アカウントを無効にしますか"
                description={
                  <>
                    <span className="font-medium">{accountName}</span> を無効にします。
                  </>
                }
                consequences={[
                  "ログイン中のすべての端末が直ちにログアウトします。",
                  "本人はログインできなくなります。",
                  "過去の申請案件や掲示板に表示される利用者名は残ります。",
                  "あとから有効に戻せます。",
                ]}
                confirmLabel="無効にする"
              />
            ) : (
              <form action={action}>
                <SubmitButton variant="secondary" fullWidth={false}>
                  有効にする
                </SubmitButton>
              </form>
            )}
          </div>
        </>
      )}
    </section>
  )
}
