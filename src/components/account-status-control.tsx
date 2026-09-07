"use client"

import { SubmitButton } from "@/components/form"
import { setAccountActiveAction } from "@/lib/accounts/actions"

/** 有効・無効の切り替え（5.4）。 */
export function AccountStatusControl({
  accountId,
  isActive,
  disabledReason,
}: {
  accountId: number
  isActive: boolean
  /** 切り替えられない場合の理由。null なら操作できる */
  disabledReason: string | null
}) {
  const action = setAccountActiveAction.bind(null, accountId, !isActive)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-bold text-slate-500">状態</h2>
      <p className="text-sm">
        現在: {isActive ? "有効" : <span className="font-bold text-slate-700">無効</span>}
      </p>

      {disabledReason ? (
        <p className="rounded-md bg-slate-100 p-3 text-xs text-slate-600">{disabledReason}</p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-slate-500">
            {isActive
              ? "無効にするとログインできなくなり、ログイン中のすべての端末が直ちにログアウトします。過去の申請案件や掲示板に表示される利用者名は残ります。"
              : "有効にすると再びログインできるようになります。パスワードは変わりません。"}
          </p>
          <form action={action} className="sm:max-w-xs">
            <SubmitButton>{isActive ? "無効にする" : "有効にする"}</SubmitButton>
          </form>
        </>
      )}
    </section>
  )
}
