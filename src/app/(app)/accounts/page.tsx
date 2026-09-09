import Link from "next/link"
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm"
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
  TabLinks,
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

/**
 * 表示する列。並び替えできない列は sort を持たない。
 * kind を持つ列は、そのタブでだけ出す。
 */
const COLUMNS: readonly { sort?: SortKey; label: string; kind?: Kind }[] = [
  { sort: "displayName", label: "利用者名" },
  { sort: "loginId", label: "ログインID" },
  { label: "権限" },
  // 所属会社が決まるのはクライアントだけ。アカウントのタブでは全行が空欄になる
  { label: "所属会社", kind: "client" },
  { sort: "isActive", label: "有効／無効" },
  { sort: "updatedAt", label: "最終更新日時" },
]

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * 一覧の切り分け。
 * クライアント権限を持つかどうかで二分するので、重複も漏れもない。
 * 両方の権限を持つアカウントはクライアント側にだけ出る。
 *
 * タブの名前は短く、読み上げ用の説明はそれだけで意味が通る長さにする。
 * 「アカウント」は見出しの下では通じるが、読み上げでは何の一覧か分からない。
 */
const KINDS = {
  internal: { label: "アカウント", caption: "クライアント以外のアカウント" },
  client: { label: "クライアント", caption: "クライアントのアカウント" },
} as const

type Kind = keyof typeof KINDS

/** G-01 アカウント一覧（5.4）。 */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string
    q?: string
    role?: string
    active?: string
    sort?: string
    dir?: string
    page?: string
    notice?: string
  }>
}) {
  const actor = await requireRoles(["staff", "admin"])
  const params = await searchParams

  const query = params.q?.trim() ?? ""
  const kind: Kind = params.kind === "client" ? "client" : "internal"
  // 権限での絞り込みはクライアント以外のタブでだけ意味を持つ。
  // クライアントのタブは権限が決まっているので、指定があっても無視する
  const role =
    kind === "internal" &&
    params.role !== "client" &&
    (USER_ROLES as readonly string[]).includes(params.role ?? "")
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
  const lacksRole = (target: UserRole) =>
    sql`not exists (select 1 from ${userRoles} where ${userRoles.userId} = ${users.id} and ${userRoles.role} = ${target})`

  // タブによらず効く条件。タブに出す件数もこれで数えるので、
  // どちらのタブに何件あるかが検索語や有効／無効の指定と食い違わない
  const shared = [
    // 事務員はシステム管理者以外のアカウントだけを閲覧できる（5.4）
    actor.roles.includes("admin") ? undefined : lacksRole("admin"),
    query
      ? or(
          like(users.displayName, `%${escapeLike(query)}%`),
          like(users.loginId, `%${escapeLike(query)}%`),
        )
      : undefined,
    activeFilter === "all" ? undefined : eq(users.isActive, activeFilter === "true"),
  ].filter(Boolean)

  const conditions = [
    ...shared,
    kind === "client" ? hasRole("client") : lacksRole("client"),
    role ? hasRole(role) : undefined,
  ].filter(Boolean)

  const sharedFilter = shared.length > 0 ? and(...shared) : undefined
  const filter = conditions.length > 0 ? and(...conditions) : undefined
  const orderColumn = sort ? SORTABLE[sort].column : users.createdAt
  const orderBy = dir === "asc" ? asc(orderColumn) : desc(orderColumn)

  const [rows, [total], [tabTotals]] = await Promise.all([
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
    db
      .select({
        client: sql<number>`sum(case when ${hasRole("client")} then 1 else 0 end)`,
        all: sql<number>`count(*)`,
      })
      .from(users)
      .where(sharedFilter),
  ])

  const clientCount = Number(tabTotals?.client ?? 0)
  const internalCount = Number(tabTotals?.all ?? 0) - clientCount
  const count = Number(total?.count ?? 0)
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const href = (next: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams()
    const merged = { kind, q: query || undefined, role, active: activeFilter, sort, dir, page, ...next }
    for (const [key, value] of Object.entries(merged)) {
      const skip =
        value === undefined ||
        value === "" ||
        (key === "page" && value === 1) ||
        (key === "active" && value === "true") ||
        (key === "kind" && value === "internal")
      if (!skip) search.set(key, String(value))
    }
    const text = search.toString()
    return text ? `/accounts?${text}` : "/accounts"
  }

  // 既定の表示（有効のみ・検索なし）から動いているか。空表示のときに解除導線を出す。
  // タブは絞り込みではなく見る対象そのものなので、解除しても切り替えない
  const narrowed = Boolean(query) || role !== undefined || activeFilter !== "true"
  const resetHref = href({ q: undefined, role: undefined, active: "true", page: 1 })

  const columns = COLUMNS.filter((column) => column.kind === undefined || column.kind === kind)

  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, count)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
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

      <TabLinks
        label="アカウントの種別"
        tabs={[
          {
            href: href({ kind: "internal", role: undefined, page: 1 }),
            label: KINDS.internal.label,
            current: kind === "internal",
            count: internalCount,
          },
          {
            href: href({ kind: "client", role: undefined, page: 1 }),
            label: KINDS.client.label,
            current: kind === "client",
            count: clientCount,
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form role="search" className="flex flex-wrap gap-2">
          {/* 検索してもタブが外れないように、いま見ている種別を持ち回る */}
          {kind === "internal" ? null : <input type="hidden" name="kind" value={kind} />}
          {/* 並び順も同じ理由で持ち回る。ページ番号は送らない
              （絞り込みが変わるので1ページ目に戻すのが正しい） */}
          {sort ? <input type="hidden" name="sort" value={sort} /> : null}
          {sort ? <input type="hidden" name="dir" value={dir} /> : null}
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
          {/* クライアントのタブでは権限が決まっているので、選ばせても結果が変わらない */}
          {kind === "internal" ? (
            <>
              <label htmlFor="role" className="sr-only">
                権限で絞り込む
              </label>
              <select
                id="role"
                name="role"
                defaultValue={role ?? ""}
                className={`${controlClass} text-sm`}
              >
                <option value="">権限すべて</option>
                {USER_ROLES.filter(
                  (r) => r !== "client" && (actor.roles.includes("admin") || r !== "admin"),
                ).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </>
          ) : null}
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
            <Link href={resetHref} className={buttonGhost}>
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
            {KINDS[kind].caption}の一覧。
            {count === 0
              ? "該当なし。"
              : `全 ${count} 件のうち ${from} 件目から ${to} 件目を表示。`}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {columns.map((column) => {
                if (!column.sort) return <Th key={column.label}>{column.label}</Th>
                const isCurrent = sort === column.sort
                const state: SortState = isCurrent
                  ? dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                // 昇順 → 降順 → 既定で一巡する。既定に戻す手段を残すため。
                const next = !isCurrent
                  ? { sort: column.sort, dir: "asc" }
                  : dir === "asc"
                    ? { sort: column.sort, dir: "desc" }
                    : { sort: undefined, dir: undefined }
                return (
                  <Th key={column.label} ariaSort={state}>
                    <SortLink
                      href={href({ ...next, page: 1 })}
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
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  条件に一致するアカウントがありません。
                  {narrowed ? (
                    <Link href={resetHref} className={`${buttonGhost} ml-2`}>
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
                  {kind === "client" ? (
                    <td className="px-4 py-2.5 text-slate-600">{row.companyName ?? "—"}</td>
                  ) : null}
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
