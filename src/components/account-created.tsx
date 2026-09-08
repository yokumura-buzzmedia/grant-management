import Link from "next/link"
import { buttonSecondary, linkClass } from "@/components/ui"

/** 作成直後の仮パスワード表示（5.4）。この画面でしか確認できない。 */
export function AccountCreated({
  created,
  backHref,
  backLabel,
  againHref,
  onAgain,
}: {
  created: { loginId: string; displayName: string; temporaryPassword: string }
  /** 一覧などへ戻る導線。作成した画面から動かない場合は省く */
  backHref?: string
  backLabel?: string
  /** 続けて作成する画面へ移る場合の遷移先 */
  againHref?: string
  /** その場で続けて作成する場合の入力欄の作り直し。againHref より優先する */
  onAgain?: () => void
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
      <div className="flex flex-wrap gap-3 text-sm">
        {backHref && backLabel ? (
          <Link href={backHref} className={linkClass}>
            {backLabel}
          </Link>
        ) : null}
        {onAgain ? (
          <button type="button" onClick={onAgain} className={buttonSecondary}>
            続けて作成する
          </button>
        ) : againHref ? (
          <Link href={againHref} className={linkClass}>
            続けて作成する
          </Link>
        ) : null}
      </div>
    </div>
  )
}
