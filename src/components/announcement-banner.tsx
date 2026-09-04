import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { announcements } from "@/db/schema"

/**
 * お知らせバナー（5.23）。ログイン画面を含むすべての画面に表示する。
 *
 * TODO: 要件では太字・斜体・下線・文字色・文字サイズとリンクを設定できる。
 * G-03 お知らせ編集の実装時にサニタイズ付きのリッチテキスト表示へ差し替える。
 * それまでは本文を平文として描画する。
 */
export async function AnnouncementBanner() {
  const [announcement] = await db
    .select({ body: announcements.body })
    .from(announcements)
    .where(eq(announcements.isEnabled, true))
    .limit(1)

  if (!announcement?.body) return null

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
      <p className="mx-auto max-w-5xl whitespace-pre-wrap">{announcement.body}</p>
    </div>
  )
}
