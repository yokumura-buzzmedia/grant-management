import Link from "next/link"
import { and, asc, desc, eq, like, notExists, or, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, userRoles, users, USER_ROLES, type UserRole } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { formatJst } from "@/lib/datetime"
import { ROLE_LABELS } from "@/lib/roles"
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

const PAGE_SIZE = 50

const SORTABLE = {
  displayName: { column: users.displayName, label: "利用者名" },
  loginId: { column: users.loginId, label: "ログインID" },
  isActive: { column: users.isActive, label: "有効／無効" },
  updatedAt: { column: users.updatedAt, label: "最終更新日時" },
} as const

type SortKey = keyof typeof SORTABLE

/** 表示する列。並び替えできない列は sort を持たない。 */
const COLUMNS: readonly { sort?: SortKey; label: string }[] = [
  { sort: "displayName", label: "利用者名" },
  { sort: "loginId", label: "ログインID" },
  { label: "権限" },
  { label: "所属会社" },
  { sort: "isActive", label: "有効／無効" },
  { sort: "updatedAt", label: "最終更新日時" },
]

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** G-01 アカウント一覧（5.4）。 */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; active?: string; sort?: string; dir?: string; page?: string; notice?: string }>
}) {
  const actor = await requireRoles(["staff", "admin"])
  const params = await searchParams

  const query = params.q?.trim() ?? ""
  const role = (USER_ROLES as readonly string[]).includes(params.role ?? "")
    ? (params.role as UserRole)
    : undefined
  // 初期表示には有効なアカウントだけを表示する（5.4）
  const activeFilter = params.active === "all" ? "all" : params.active === "false" ? "false" : "true"
  const sort = (params.sort && params.sort in SORTABLE ? params.sort : undefined) as
    | SortKey
    | undefined
  const dir = params.dir === "asc" ? "asc" : "desc"
  const page = Math.max(1, Number(params.page) || 1)

  const hasRole = (target: UserRole) =>
    sql`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${users.id} and ${userRoles.role} = ${target})`

  const conditions = [
    // 事務員はシステム管理者以外のアカウントだけを閲覧できる（5.4）
    actor.roles.includes("admin")
      ? undefined
      : notExists(
          db
            .select({ one: sql`1` })
            .from(userRoles)
            .where(and(eq(userRoles.userId, users.id), eq(userRoles.role, "admin"))),
        ),
    query
      ? or(
          like(users.displayName, `%${escapeLike(query)}%`),
          like(users.loginId, `%${escapeLike(query)}%`),
        )
      : undefined,
    role ? hasRole(role) : undefined,
    activeFilter === "all" ? undefined : eq(users.isActive, activeFilter === "true"),
  ].filter(Boolean)

  const filter = conditions.length > 0 ? and(...conditions) : undefined
  const orderColumn = sort ? SORTABLE[sort].column : users.createdAt
  const orderBy = dir === "asc" ? asc(orderColumn) : desc(orderColumn)

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        loginId: users.loginId,
        displayName: users.displayName,
        isActive: users.isActive,
        updatedAt: users.updatedAt,
        companyName: companies.name,
        roles: sql<string | null>`(
          select group_concat(${userRoles.role} order by ${userRoles.role})
            from ${userRoles} where ${userRoles.userId} = ${users.id})`,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(filter)
      .orderBy(orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)` }).from(users).where(filter),
  ])

  const count = Number(total?.count ?? 0)
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const href = (next: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    const merged = { q: query || undefined, role, active: activeFilter, sort, dir, page, ...next }
    for (const [key, value] of Object.entries(merged)) {
      const skip =
        value === undefined || value === "" || (key === "page" && value === 1) || (key === "active" && value === "true")
      if (!skip) search.set(key, String(value))
    }
    const text = search.toString()
    return text ? `/accounts?${text}` : "/accounts"
  }

  // 既定の表示（有効のみ・検索なし）から動いているか。空表示のときに解除導線を出す
  const narrowed = Boolean(query) || role !== undefined || activeFilter !== "true"

  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        screenId="G-01"
        title="アカウント一覧"
        description="利用者名を選ぶと編集・削除ができます。"
        action={
          <Link href="/accounts/new" className={buttonPrimary}>
            アカウントを作成
          </Link>
        }
      />

      {params.notice === "deleted" ? (
        <Notice>アカウントを削除しました。削除履歴に記録しています。</Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form role="search" className="flex flex-wrap gap-2">
          <label htmlFor="q" className="sr-only">
            利用者名・ログインIDで検索
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="利用者名・ログインIDで検索"
            className={`${controlClass} w-64`}
          />
          <label htmlFor="role" className="sr-only">
            権限で絞り込む
          </label>
          <select id="role" name="role" defaultValue={role ?? ""} className={`${controlClass} text-sm`}>
            <option value="">権限すべて</option>
            {USER_ROLES.filter((r) => actor.roles.includes("admin") || r !== "admin").map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <label htmlFor="active" className="sr-only">
            有効／無効で絞り込む
          </label>
          <select
            id="active"
            name="active"
            defaultValue={activeFilter}
            className={`${controlClass} text-sm`}
          >
            <option value="true">有効のみ</option>
            <option value="false">無効のみ</option>
            <option value="all">すべて</option>
          </select>
          <button type="submit" className={buttonSecondary}>
            絞り込む
          </button>
          {narrowed ? (
            <Link href="/accounts" className={buttonGhost}>
              解除
            </Link>
          ) : null}
        </form>

        <ResultCount page={page} pageSize={PAGE_SIZE} count={count} />
      </div>

      {/* relative が要る。sr-only は position:absolute のため、位置指定された祖先が
          ないと overflow-x-auto の外へ出てしまい、ページ全体が横スクロールする */}
      <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">
            アカウントの一覧。
            {count === 0
              ? "該当なし。"
              : `全 ${count} 件のうち ${from} 件目から ${to} 件目を表示。`}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {COLUMNS.map((column) => {
                if (!column.sort) return <Th key={column.label}>{column.label}</Th>
                const isCurrent = sort === column.sort
                const state: SortState = isCurrent
                  ? dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                return (
                  <Th key={column.label} ariaSort={state}>
                    <SortLink
                      href={href({
                        sort: column.sort,
                        dir: isCurrent && dir === "asc" ? "desc" : "asc",
                        page: 1,
                      })}
                      label={column.label}
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
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-slate-500">
                  条件に一致するアカウントがありません。
                  {narrowed ? (
                    <Link href="/accounts" className={`${buttonGhost} ml-2`}>
                      絞り込みを解除
                    </Link>
                  ) : null}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    <Link href={`/accounts/${row.id}`} className={rowLinkClass}>
                      {row.displayName}
                    </Link>
                  </th>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{row.loginId}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {row.roles
                      ? row.roles
                          .split(",")
                          .map((r) => ROLE_LABELS[r as UserRole] ?? r)
                          .join("・")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.companyName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {row.isActive ? (
                      <span className="text-slate-600">有効</span>
                    ) : (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">無効</span>
                    )}
                  </td>
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
