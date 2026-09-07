import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { deletionLogs, DELETION_TARGET_TYPES, type DeletionTargetType } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { formatJst } from "@/lib/datetime"
import { FilterChip, PageHeader, Pagination, ResultCount, Th } from "@/components/ui"

const PAGE_SIZE = 50

const TARGET_LABELS: Record<DeletionTargetType, string> = {
  company: "会社",
  user: "アカウント",
  project: "申請案件",
}

/** detail は対象種別ごとに構造が違う（04_DB論理設計.md 2.4）。 */
const describe = (targetType: DeletionTargetType, detail: unknown) => {
  const d = detail as Record<string, string | null>
  if (targetType === "company") {
    return { name: d.companyName ?? "—", sub: d.corporateNumber ?? "法人番号なし" }
  }
  if (targetType === "user") {
    return { name: d.displayName ?? "—", sub: d.loginId ?? "—" }
  }
  return { name: d.projectNumber ?? "—", sub: d.companyName ?? "—" }
}

/**
 * G-04 削除履歴（5.3, 5.4, 5.15）。
 * 事務員とシステム管理者が閲覧できる。どちらも削除できないため、削除機能は設けない。
 */
export default async function DeletionLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>
}) {
  await requireRoles(["staff", "admin"])
  const params = await searchParams

  const type = (DELETION_TARGET_TYPES as readonly string[]).includes(params.type ?? "")
    ? (params.type as DeletionTargetType)
    : undefined
  const page = Math.max(1, Number(params.page) || 1)
  const filter = type ? eq(deletionLogs.targetType, type) : undefined

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(deletionLogs)
      .where(filter)
      .orderBy(desc(deletionLogs.deletedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` }).from(deletionLogs).where(filter),
  ])

  const count = Number(total?.count ?? 0)
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const href = (next: { type?: string; page?: number }) => {
    const search = new URLSearchParams()
    const merged = { type, page, ...next }
    if (merged.type) search.set("type", merged.type)
    if (merged.page && merged.page > 1) search.set("page", String(merged.page))
    const text = search.toString()
    return text ? `/deletion-logs?${text}` : "/deletion-logs"
  }

  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        screenId="G-04"
        title="削除履歴"
        description="削除の記録は誰も消せません。閲覧のみです。"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="種別で絞り込む" className="flex flex-wrap gap-2">
          <FilterChip href={href({ type: undefined, page: 1 })} current={!type}>
            すべて
          </FilterChip>
          {DELETION_TARGET_TYPES.map((value) => (
            <FilterChip key={value} href={href({ type: value, page: 1 })} current={type === value}>
              {TARGET_LABELS[value]}
            </FilterChip>
          ))}
        </nav>

        <ResultCount page={page} pageSize={PAGE_SIZE} count={count} />
      </div>

      {/* relative が要る。sr-only は position:absolute のため、位置指定された祖先が
          ないと overflow-x-auto の外へ出てしまい、ページ全体が横スクロールする */}
      <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">
            {type ? `${TARGET_LABELS[type]}の削除履歴。` : "削除履歴。"}
            {count === 0
              ? "該当なし。"
              : `全 ${count} 件のうち ${from} 件目から ${to} 件目を表示。`}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <Th>削除日時</Th>
              <Th>種別</Th>
              <Th>対象</Th>
              <Th>削除した利用者</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                  {type ? `${TARGET_LABELS[type]}の削除履歴はありません。` : "削除履歴はありません。"}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const target = describe(row.targetType, row.detail)
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">
                      {formatJst(row.deletedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{TARGET_LABELS[row.targetType]}</td>
                    {/* 行を識別するのは対象名。読み上げで行の名前として使われる */}
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {target.name}
                      <span className="ml-2 font-mono text-xs font-normal text-slate-600">
                        {target.sub}
                      </span>
                    </th>
                    <td className="px-4 py-2.5 text-slate-600">{row.deletedByName}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} lastPage={lastPage} href={(next) => href({ page: next })} />
    </div>
  )
}
