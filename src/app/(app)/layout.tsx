import Link from "next/link"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { logoutAction } from "@/lib/auth/actions"
import { ROLE_LABELS, requireActiveUser } from "@/lib/auth/guards"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 権限は毎リクエスト user_roles を参照する（5.19）
  const user = await requireActiveUser()
  const canManage = user.roles.includes("staff") || user.roles.includes("admin")

  return (
    <div className="min-h-dvh">
      <AnnouncementBanner />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="font-bold">
            助成金管理システム
          </Link>
          {canManage ? (
            <nav className="flex gap-3 text-sm">
              <Link href="/companies" className="text-slate-600 underline">
                会社
              </Link>
            </nav>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>
              {user.displayName}
              <span className="ml-2 text-slate-500">
                {user.roles.map((role) => ROLE_LABELS[role]).join("・") || "権限なし"}
              </span>
            </span>
            <Link href="/password/change" className="text-slate-600 underline">
              パスワード変更
            </Link>
            <Link href="/login-id" className="text-slate-600 underline">
              ログインID変更
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="text-slate-600 underline">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
