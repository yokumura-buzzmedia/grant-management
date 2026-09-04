import { redirect } from "next/navigation"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { getCurrentUser } from "@/lib/auth/current-user"
import { initialPath } from "@/lib/auth/guards"
import { LoginForm } from "./login-form"

/** 再ログインを促す画面から渡される案内。 */
const NOTICES: Record<string, string> = {
  "password-set": "新しいパスワードを設定しました。新しいパスワードでログインしてください。",
  "password-changed":
    "パスワードを変更しました。すべての端末からログアウトしています。新しいパスワードでログインしてください。",
  "login-id-changed": "ログインIDを変更しました。新しいログインIDでログインしてください。",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const user = await getCurrentUser()
  if (user) redirect(user.isTemporaryPassword ? "/password/setup" : initialPath(user.roles))

  const { notice } = await searchParams
  const message = notice ? NOTICES[notice] : undefined

  return (
    <div className="min-h-dvh">
      <AnnouncementBanner />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
        <h1 className="text-center text-xl font-bold">助成金管理システム</h1>

        {message ? (
          <p className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
            {message}
          </p>
        ) : null}

        <LoginForm />

        <p className="text-center text-xs leading-relaxed text-slate-500">
          パスワードが分からない場合は、事務員またはシステム管理者へ連絡してください。
          <br />
          仮パスワードを再発行します。
        </p>
      </main>
    </div>
  )
}
