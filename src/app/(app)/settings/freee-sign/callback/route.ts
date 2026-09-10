import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { requireRoles } from "@/lib/auth/guards"
import { completeAuthorization, FreeeSignError } from "@/lib/freee-sign"
import { clearAuthorizationState, readAuthorizationState } from "@/lib/freee-sign/actions"

/**
 * freeeサインの認可コードを受け取る（05_外部連携仕様.md 3.2）。
 *
 * **ルートハンドラにはレイアウトのガードが効かない。** `(app)` の下にあっても
 * layout.tsx は通らないので、ここで権限を確認する。
 *
 * 3.1 で「設けない」と決めた外部からの受信エンドポイントは Webhook のことで、
 * これは利用者のブラウザが戻ってくる先。誰でも叩けるが、ログイン済みの
 * システム管理者で、かつ自分で認可を始めた端末でなければ何もしない。
 */
export async function GET(request: NextRequest) {
  const actor = await requireRoles(["admin"])

  const back = (kind: "notice" | "error", value: string): never =>
    redirect(`/settings/freee-sign?${kind}=${value}`)

  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const returnedState = params.get("state")

  // 認可を始めた端末かどうか。始めていなければ、踏まされた戻りとして捨てる
  const expected = await readAuthorizationState()
  await clearAuthorizationState()
  if (!expected) return back("error", "noState")
  // freeeサインは state を返す保証がない。返ってきたときだけ突き合わせる
  if (returnedState && returnedState !== expected) return back("error", "stateMismatch")
  if (!code) return back("error", "noCode")

  try {
    await completeAuthorization(code, actor)
  } catch (error) {
    // トークン交換の失敗理由は相手側の都合。詳細は画面に出さず、やり直せるようにする
    if (error instanceof FreeeSignError) return back("error", "exchangeFailed")
    throw error
  }

  return back("notice", "connected")
}
