import Link from "next/link"
import { asc, desc, like, or, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { formatJst } from "@/lib/datetime"

/** 一覧は1ページ50件（06_画面設計.md 2.2）。 */
const PAGE_SIZE = 50

/** 列見出しから並び替えられる列（5.3）。 */
const SORTABLE = {
  name: { column: companies.name, label: "会社名" },
  corporateNumber: { column: companies.corporateNumber, label: "法人番号" },
  contactName: { column: companies.contactName, label: "担当者名" },
  phone: { column: companies.phone, label: "電話番号" },
  updatedAt: { column: companies.updatedAt, label: "最終更新日時" },
} as const

type SortKey = keyof typeof SORTABLE

/** LIKE のメタ文字を打ち消す。MySQL の既定のエスケープ文字はバックスラッシュ。 */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string; page?: string }>
}) {
  await requireRoles(["staff", "admin"])
  const params = await searchParams

  const query = params.q?.trim() ?? ""
  const sort = (params.sort && params.sort in SORTABLE ? params.sort : undefined) as
    | SortKey
    | undefined
  const dir = params.dir === "asc" ? "asc" : "desc"
  const page = Math.max(1, Number(params.page) || 1)

  const filter = query
    ? or(
        like(companies.name, `%${escapeLike(query)}%`),
        like(companies.corporateNumber, `%${escapeLike(query)}%`),
      )
    : undefined

  // 初期表示順は作成日時が新しい順（5.3）
  const orderColumn = sort ? SORTABLE[sort].column : companies.createdAt
  const orderBy = dir === "asc" ? asc(orderColumn) : desc(orderColumn)

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        corporateNumber: companies.corporateNumber,
        contactName: companies.contactName,
        phone: companies.phone,
        updatedAt: companies.updatedAt,
      })
      .from(companies)
      .where(filter)
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` }).from(companies).where(filter),
  ])

  const count = Number(total?.count ?? 0)
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const href = (next: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    const merged = { q: query || undefined, sort, dir, page, ...next }
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) {
        search.set(key, String(value))
      }
    }
    const text = search.toString()
    return text ? `/companies?${text}` : "/companies"
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          <span className="mr-2 rounded bg-slate-200 px-2 py-0.5 font-mono text-sm">D-01</span>
          会社一覧
        </h1>
        <Link
          href="/companies/new"
          className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          会社を登録
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="会社名・法人番号で検索"
          className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-900"
        />
        <button type="submit" className="rounded-md border border-slate-300 bg-white px-4 text-sm">
          検索
        </button>
        {query ? (
          <Link
            href="/companies"
            className="flex items-center rounded-md px-3 text-sm text-slate-600 underline"
          >
            解除
          </Link>
        ) : null}
      </form>

      <p className="text-sm text-slate-600">
        {count} 件{count > PAGE_SIZE ? `（${page} / ${lastPage} ページ）` : ""}
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {(Object.keys(SORTABLE) as SortKey[]).map((key) => {
                const active = sort === key
                return (
                  <th key={key} className="px-4 py-3 font-medium text-slate-600">
                    <Link
                      href={href({ sort: key, dir: active && dir === "asc" ? "desc" : "asc", page: 1 })}
                      className="hover:underline"
                    >
                      {SORTABLE[key].label}
                      {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
                    </Link>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {query ? "検索条件に一致する会社がありません。" : "登録されている会社がありません。"}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${row.id}`} className="font-medium underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{row.corporateNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.contactName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatJst(row.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {lastPage > 1 ? (
        <div className="flex items-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="underline">
              前へ
            </Link>
          ) : null}
          <span className="text-slate-600">
            {page} / {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={href({ page: page + 1 })} className="underline">
              次へ
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
