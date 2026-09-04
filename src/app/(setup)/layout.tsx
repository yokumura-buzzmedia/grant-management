import { redirect } from "next/navigation"
import { AnnouncementBanner } from "@/components/announcement-banner"
import { requireUser } from "@/lib/auth/guards"

/** 仮パスワードの状態でのみ表示する。設定済みの利用者は通常画面へ戻す。 */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  if (!user.isTemporaryPassword) redirect("/")

  return (
    <div className="min-h-dvh">
      <AnnouncementBanner />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">{children}</main>
    </div>
  )
}
