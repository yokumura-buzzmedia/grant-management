import Link from "next/link"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { NavLink } from "@/components/nav-link"
import { buttonGhost, linkClass } from "@/components/ui"
import { logoutAction } from "@/lib/auth/actions"
import { requireActiveUser } from "@/lib/auth/guards"
import { ROLE_LABELS } from "@/lib/roles"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 権限は毎リクエスト user_roles を参照する（5.19）
  const user = await requireActiveUser()
  const canManage = user.roles.includes("staff") || user.roles.includes("admin")

  return (
    <div className="min-h-dvh">
      <AnnouncementBanner />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="rounded-sm font-bold text-slate-900">
            助成金管理システム
          </Link>
          {canManage ? (
            <nav aria-label="主要メニュー" className="flex gap-1">
              <NavLink href="/companies">会社</NavLink>
              <NavLink href="/accounts">アカウント</NavLink>
              <NavLink href="/deletion-logs">削除履歴</NavLink>
            </nav>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex flex-col leading-tight">
              <span className="font-medium text-slate-900">{user.displayName}</span>
              <span className="text-xs text-slate-500">
                {user.roles.map((role) => ROLE_LABELS[role]).join("・") || "権限なし"}
              </span>
            </span>
            <span aria-hidden className="h-5 w-px bg-slate-200" />
            <Link href="/password/change" className={linkClass}>
              パスワード変更
            </Link>
            <Link href="/login-id" className={linkClass}>
              ログインID変更
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={buttonGhost + " px-2 py-1"}>
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
