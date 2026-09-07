import { PasswordForm } from "@/components/password-form"
import { changePasswordAction } from "@/lib/auth/actions"

/** A-03 パスワード変更。変更時に現在のパスワードは求めない（5.4）。 */
export default function PasswordChangePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-xl font-bold">パスワードの変更</h1>
      <PasswordForm action={changePasswordAction} submitLabel="変更する" />
      <p className="text-xs leading-relaxed text-slate-500">
        変更するとこの端末を含むすべての端末からログアウトします。
      </p>
    </div>
  )
}
