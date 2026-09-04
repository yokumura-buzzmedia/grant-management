import { PasswordForm } from "@/components/password-form"
import { setPasswordAction } from "@/lib/auth/actions"

/**
 * A-02 初回パスワード設定。
 * 仮パスワードでログインした場合に必ず経由し、設定するまで他の機能を利用できない（5.4）。
 */
export default function PasswordSetupPage() {
  return (
    <>
      <h1 className="text-xl font-bold">パスワードの設定</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        仮パスワードでログインしています。新しいパスワードを設定するまで、他の機能は利用できません。
      </p>
      <PasswordForm action={setPasswordAction} submitLabel="設定する" />
      <p className="text-xs leading-relaxed text-slate-500">
        設定するとすべての端末からログアウトします。新しいパスワードで再度ログインしてください。
      </p>
    </>
  )
}
