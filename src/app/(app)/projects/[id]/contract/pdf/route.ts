import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, contracts, projects } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { fetchDocumentPdf, FreeeSignError } from "@/lib/freee-sign"
import { projectScope } from "@/lib/projects/authorize"
import { createDownloadUrl, createPreviewUrl } from "@/lib/storage"

/**
 * 契約書のPDFを返す（05_外部連携仕様.md 3.10）。
 *
 * 締結前と締結後で出どころが違う。
 *
 * | 状態 | 出どころ | 理由 |
 * | --- | --- | --- |
 * | 締結済み | S3（`pdf_file_key`） | 締結した契約書は手元に残す。freeeサインが使えなくなっても読める |
 * | それ以外 | freeeサインから都度取得 | 署名の途中で内容が変わる。保存すると古いものを見せてしまう |
 *
 * **ルートハンドラにはレイアウトのガードが効かない。** ここで権限を確認する。
 * 見える範囲は一覧・詳細と同じ判定（`projectScope`）を使う。判定を写して持つと、
 * どれか1つを直し忘れたときに他社の契約書が見える。
 */

const notFound = () =>
  new Response("契約書が見つかりません。", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  })

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoles(["client", "staff", "advisor", "agency", "admin"])

  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId) || projectId <= 0) return notFound()

  const [row] = await db
    .select({
      projectNumber: projects.projectNumber,
      companyName: companies.name,
      freeeSignDocumentId: contracts.freeeSignDocumentId,
      sentAt: contracts.sentAt,
      pdfFileKey: contracts.pdfFileKey,
    })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(companies, eq(companies.id, projects.companyId))
    .where(and(eq(contracts.projectId, projectId), projectScope(user)))
    .limit(1)
  // 権限の外と、まだ送っていない場合を区別しない。存在だけが漏れないようにする
  if (!row?.sentAt || !row.freeeSignDocumentId) return notFound()

  // 保存用と表示用で署名が変わる。表示用のURLを保存用へ書き換えることはできない
  const download = request.nextUrl.searchParams.get("download") === "1"
  const filename = `${row.projectNumber}_${row.companyName}_契約書.pdf`

  if (row.pdfFileKey) {
    const url = download
      ? await createDownloadUrl(row.pdfFileKey, filename, "application/pdf")
      : await createPreviewUrl(row.pdfFileKey, filename, "application/pdf")
    redirect(url)
  }

  // 締結前。freeeサインの生成が終わっていないと取れないので、その旨を返す
  try {
    const pdf = await fetchDocumentPdf(row.freeeSignDocumentId)
    return new Response(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
        // 署名の途中で内容が変わる。古いものを見せない
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof FreeeSignError) {
      return new Response(error.message, {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    }
    throw error
  }
}
