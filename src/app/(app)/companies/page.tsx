import Link from "next/link"
import { asc, desc, like, or, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { formatJst } from "@/lib/datetime"
import {
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  controlClass,
  Notice,
  PageHeader,
  Pagination,
  ResultCount,
  rowLinkClass,
  SortLink,
  type SortState,
  Th,
} from "@/components/ui"

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
  searchParams: Promise<{ q?: string; sort?: string; dir?: string; page?: string; notice?: string }>
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

  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="会社一覧"
        action={
          <Link href="/companies/new" className={buttonPrimary}>
            会社を登録
          </Link>
        }
      />

      {params.notice === "deleted" ? (
        <Notice>会社を削除しました。削除履歴に記録しています。</Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form role="search" className="flex flex-wrap gap-2">
          {/* 検索しても並び順が外れないように持ち回る。ページ番号は送らない
              （絞り込みが変わるので1ページ目に戻すのが正しい） */}
          {sort ? <input type="hidden" name="sort" value={sort} /> : null}
          {sort ? <input type="hidden" name="dir" value={dir} /> : null}
          <label htmlFor="q" className="sr-only">
            会社名・法人番号で検索
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="会社名・法人番号で検索"
            className={`${controlClass} w-72`}
          />
          <button type="submit" className={buttonSecondary}>
            検索
          </button>
          {query ? (
            <Link href="/companies" className={buttonGhost}>
              解除
            </Link>
          ) : null}
        </form>

        <ResultCount page={page} pageSize={PAGE_SIZE} count={count} />
      </div>

      {/* relative が要る。sr-only は position:absolute のため、位置指定された祖先が
          ないと overflow-x-auto の外へ出てしまい、ページ全体が横スクロールする */}
      <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">
            {query ? `「${query}」で検索した会社の一覧。` : "会社の一覧。"}
            {count === 0 ? "該当なし。" : `全 ${count} 件のうち ${from} 件目から ${to} 件目を表示。`}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {(Object.keys(SORTABLE) as SortKey[]).map((key) => {
                const active = sort === key
                const state: SortState = active
                  ? dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                // 昇順 → 降順 → 既定（作成日時の新しい順）で一巡する。
                // 既定に戻す手段がないと、一度並べ替えたら開き直すしかなくなる。
                const next = !active
                  ? { sort: key, dir: "asc" }
                  : dir === "asc"
                    ? { sort: key, dir: "desc" }
                    : { sort: undefined, dir: undefined }
                return (
                  <Th key={key} ariaSort={state}>
                    <SortLink
                      href={href({ ...next, page: 1 })}
                      label={SORTABLE[key].label}
                      state={state}
                    />
                  </Th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  {query ? (
                    <>
                      「{query}」に一致する会社がありません。
                      <Link href="/companies" className={`${buttonGhost} ml-2`}>
                        検索を解除
                      </Link>
                    </>
                  ) : (
                    "登録されている会社がありません。"
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    <Link
                      href={`/companies/${row.id}`}
                      className={rowLinkClass}
                    >
                      {row.name}
                    </Link>
                  </th>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">
                    {row.corporateNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.contactName ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">
                    {formatJst(row.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} lastPage={lastPage} href={(next) => href({ page: next })} />
    </div>
  )
}
