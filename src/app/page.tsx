import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/current-user"
import { initialPath } from "@/lib/auth/guards"

/** アクターごとの初期表示画面へ振り分ける（5.14）。 */
export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.isTemporaryPassword) redirect("/password/setup")
  redirect(initialPath(user.roles))
}
