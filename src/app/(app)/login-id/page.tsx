import { requireActiveUser } from "@/lib/auth/guards"
import { LoginIdForm } from "./login-id-form"

/** A-04 ログインID変更。本人が変更する場合は現在のパスワードが必須（5.4）。 */
export default async function LoginIdPage() {
  const user = await requireActiveUser()

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-xl font-bold">ログインIDの変更</h1>
      <p className="text-sm text-slate-600">
        現在のログインID: <span className="font-mono font-medium">{user.loginId}</span>
      </p>
      <LoginIdForm />
      <p className="text-xs leading-relaxed text-slate-500">
        変更するとログアウトします。新しいログインIDで再度ログインしてください。
      </p>
    </div>
  )
}
