import Link from "next/link"

/** 作成直後の仮パスワード表示（5.4）。この画面でしか確認できない。 */
export function AccountCreated({
  created,
  backHref,
  backLabel,
  againHref,
}: {
  created: { loginId: string; displayName: string; temporaryPassword: string }
  backHref: string
  backLabel: string
  againHref: string
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-emerald-300 bg-emerald-50 p-6">
      <h2 className="font-bold text-emerald-900">アカウントを作成しました</h2>
      <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
        <dt className="text-slate-600">利用者名</dt>
        <dd>{created.displayName}</dd>
        <dt className="text-slate-600">ログインID</dt>
        <dd className="font-mono">{created.loginId}</dd>
        <dt className="text-slate-600">仮パスワード</dt>
        <dd className="font-mono text-lg font-bold">{created.temporaryPassword}</dd>
      </dl>
      <p className="text-sm leading-relaxed text-emerald-900">
        仮パスワードはこの画面でしか確認できません。メールまたはLINEで本人へ伝えてください。
        忘れた場合は仮パスワードを再生成します。
      </p>
      <div className="flex gap-3 text-sm">
        <Link href={backHref} className="underline">
          {backLabel}
        </Link>
        <Link href={againHref} className="underline">
          続けて作成する
        </Link>
      </div>
    </div>
  )
}
