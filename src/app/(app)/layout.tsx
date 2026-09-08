import Link from "next/link"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { MainMenu } from "@/components/main-menu"
import { NavLink } from "@/components/nav-link"
import { requireActiveUser } from "@/lib/auth/guards"
import { ROLE_LABELS } from "@/lib/roles"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 権限は毎リクエスト user_roles を参照する（5.19）
  const user = await requireActiveUser()
  const canManage = user.roles.includes("staff") || user.roles.includes("admin")

  // クライアントは会社一覧を使えないので、自社の会社情報へ直接入る（06_画面設計.md 5）
  const links = canManage
    ? ([
        { href: "/companies", label: "会社", icon: "company" },
        { href: "/accounts", label: "アカウント", icon: "accounts" },
        { href: "/deletion-logs", label: "削除履歴", icon: "deletionLogs" },
      ] as const)
    : user.roles.includes("client") && user.companyId
      ? ([{ href: `/companies/${user.companyId}`, label: "会社情報", icon: "company" }] as const)
      : []

  return (
    <div className="min-h-dvh">
      <AnnouncementBanner />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          {links.length > 0 ? <MainMenu links={links} /> : null}
          <Link href="/" className="rounded-sm font-bold text-slate-900">
            助成金管理システム
          </Link>
          {/* 誰でログインしているかは常に見えている必要があるので、名前と権限は畳まない */}
          <NavLink href="/mypage" className="ml-auto">
            <span className="flex flex-col leading-tight text-left">
              <span className="font-medium">{user.displayName}</span>
              <span className="text-xs text-slate-500">
                {user.roles.map((role) => ROLE_LABELS[role]).join("・") || "権限なし"}
              </span>
            </span>
            {/* 名前と権限だけでは行き先が伝わらないので、読み上げにだけ残す */}
            <span className="sr-only">マイページ</span>
          </NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
