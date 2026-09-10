import Link from "next/link"
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, projects, type ProjectStatus } from "@/db/schema"
import { requireRoles } from "@/lib/auth/guards"
import { projectScope } from "@/lib/projects/authorize"
import { formatJst } from "@/lib/datetime"
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_OPTIONS, statusNumber } from "@/lib/projects/status"
import {
  actionCellClass,
  actionHeadClass,
  buttonGhost,
  buttonPrimary,
  buttonSecondary,
  controlClass,
  EditLink,
  linkClass,
  Notice,
  PageHeader,
  Pagination,
  ResultCount,
  SortLink,
  type SortState,
  Th,
} from "@/components/ui"

/**
 * C-01 申請案件一覧（01_要件定義.md 5.14）。
 *
 * 見える範囲は権限で変わる（06_画面設計.md 5）。
 * 事務員・システム管理者・社労士は全件、クライアントは自社、代理店は紹介した会社。
 * 講師は使えないため、requireRoles で弾く。
 *
 * 行から案件詳細（C-02）へ入る導線は、その画面ができてから足す。
 */

/** 一覧は1ページ50件（5.14）。 */
const PAGE_SIZE = 50

/** 列見出しから並び替えられる列（5.14）。 */
const SORTABLE = {
  projectNumber: { column: projects.projectNumber, label: "案件番号" },
  companyName: { column: companies.name, label: "会社名" },
  name: { column: projects.name, label: "案件名" },
  primaryStaffName: { column: projects.primaryStaffName, label: "主担当事務員" },
  updatedAt: { column: projects.updatedAt, label: "最終更新日時" },
} as const

type SortKey = keyof typeof SORTABLE

const NOTICES: Record<string, string> = {
  created: "申請案件を作成しました。",
  deleted: "申請案件を削除しました。",
}

/** LIKE のメタ文字を打ち消す。MySQL の既定のエスケープ文字はバックスラッシュ。 */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** 昇順 → 降順 → 既定 と一巡する。既定へ戻す手段を残すため（会社一覧と同じ） */
const nextSort = (key: SortKey, sort: SortKey | undefined, dir: "asc" | "desc") =>
  sort !== key
    ? { sort: key, dir: "asc" }
    : dir === "asc"
      ? { sort: key, dir: "desc" }
      : { sort: undefined, dir: undefined }

const sortState = (key: SortKey, sort: SortKey | undefined, dir: "asc" | "desc"): SortState =>
  sort !== key ? "none" : dir === "asc" ? "ascending" : "descending"

/** 現在のステータス。25段階あるので、番号と名前を並べて出す */
function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-600">
        {statusNumber(status)}
      </span>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  )
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireRoles(["client", "staff", "advisor", "agency", "admin"])
  const params = await searchParams
  const raw = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined

  const query = raw("q")?.trim() ?? ""
  const sortParam = raw("sort")
  const sort = (sortParam && sortParam in SORTABLE ? sortParam : undefined) as SortKey | undefined
  // 既定は案件番号の降順（5.14）
  const dir = raw("dir") === "asc" ? "asc" : "desc"
  const page = Math.max(1, Number(raw("page")) || 1)
  const notice = raw("notice")

  const statusParam = raw("status")
  const status = PROJECT_STATUS_OPTIONS.some((option) => option.value === statusParam)
    ? (statusParam as ProjectStatus)
    : undefined
  const staffParam = Number(raw("staff"))
  const staffId = Number.isInteger(staffParam) && staffParam > 0 ? staffParam : undefined

  /**
   * 見える範囲（06_画面設計.md 5）。
   * クライアントに会社が、代理店に代理店が紐づいていないときは1件も出さない。
   * 絞り込みの条件を落として全件が見えるほうが危険なため。
   */
  const canManage = user.roles.includes("staff") || user.roles.includes("admin")
  const canSeeAll = canManage || user.roles.includes("advisor")
  const scope = projectScope(user)

  const filter = and(
    scope,
    query
      ? or(
          like(projects.projectNumber, `%${escapeLike(query)}%`),
          like(projects.name, `%${escapeLike(query)}%`),
          like(companies.name, `%${escapeLike(query)}%`),
        )
      : undefined,
    status ? eq(projects.status, status) : undefined,
    staffId ? eq(projects.primaryStaffId, staffId) : undefined,
  )

  const orderBy = sort
    ? [dir === "asc" ? asc(SORTABLE[sort].column) : desc(SORTABLE[sort].column)]
    : [desc(projects.projectNumber)]

  const [rows, [total], staffOptions] = await Promise.all([
    db
      .select({
        id: projects.id,
        projectNumber: projects.projectNumber,
        name: projects.name,
        status: projects.status,
        primaryStaffName: projects.primaryStaffName,
        updatedAt: projects.updatedAt,
        companyName: companies.name,
      })
      .from(projects)
      .innerJoin(companies, eq(companies.id, projects.companyId))
      .where(filter)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .innerJoin(companies, eq(companies.id, projects.companyId))
      .where(filter),
    // 主担当の選択肢は、実際に案件に割り当てられている事務員から採る。
    // 見える範囲の外の担当者は出さない
    db
      .selectDistinct({ id: projects.primaryStaffId, name: projects.primaryStaffName })
      .from(projects)
      .innerJoin(companies, eq(companies.id, projects.companyId))
      .where(and(scope, sql`${projects.primaryStaffId} is not null`))
      .orderBy(asc(projects.primaryStaffName)),
  ])

  const count = Number(total?.count ?? 0)
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const narrowed = Boolean(query) || status !== undefined || staffId !== undefined

  const href = (next: Record<string, string | number | undefined>) => {
    const merged: Record<string, string | number | undefined> = {
      q: query || undefined,
      status,
      staff: staffId,
      sort,
      dir: sort ? dir : undefined,
      page,
      ...next,
    }
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === "" || (key === "page" && value === 1)) continue
      search.set(key, String(value))
    }
    const text = search.toString()
    return text ? `/projects?${text}` : "/projects"
  }

  const resetHref = href({ q: undefined, status: undefined, staff: undefined, page: 1 })
  // 詳細から戻ったときに同じ絞り込みへ戻す
  const listQuery = href({}).split("?")[1] ?? ""
  const detailHref = (id: number) => `/projects/${id}${listQuery ? `?${listQuery}` : ""}`

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="申請案件"
        description={
          canSeeAll
            ? "案件番号・案件名・会社名で検索できます。"
            : "自社に関係する申請案件です。案件番号・案件名で検索できます。"
        }
        action={
          // 作成できるのは事務員とシステム管理者だけ（06_画面設計.md 5 の C-09）
          canManage ? (
            <Link href="/projects/new" className={buttonPrimary}>
              新規作成
            </Link>
          ) : null
        }
      />

      {notice && NOTICES[notice] ? <Notice>{NOTICES[notice]}</Notice> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form role="search" className="flex flex-wrap gap-2">
          {/* 並び順は持ち回る。ページ番号は送らない
              （絞り込みが変わるので1ページ目に戻すのが正しい） */}
          {sort ? <input type="hidden" name="sort" value={sort} /> : null}
          {sort ? <input type="hidden" name="dir" value={dir} /> : null}
          <label htmlFor="q" className="sr-only">
            案件番号・案件名・会社名で検索
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="案件番号・案件名・会社名で検索"
            className={`${controlClass} w-64`}
          />
          <label htmlFor="status" className="sr-only">
            ステータスで絞り込む
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className={`${controlClass} text-sm`}
          >
            <option value="">ステータスすべて</option>
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label htmlFor="staff" className="sr-only">
            主担当事務員で絞り込む
          </label>
          <select
            id="staff"
            name="staff"
            defaultValue={staffId ? String(staffId) : ""}
            className={`${controlClass} text-sm`}
          >
            <option value="">主担当すべて</option>
            {staffOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name}
              </option>
            ))}
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
        <table className="w-full min-w-[960px] text-sm">
          <caption className="sr-only">
            申請案件の一覧。
            {count === 0 ? "該当なし。" : `全 ${count} 件のうち ${rows.length} 件を表示。`}
          </caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              {/* 並びは5.14のとおり。ステータスは最終更新日時の手前に置く */}
              {(["projectNumber", "companyName", "name", "primaryStaffName"] as SortKey[]).map(
                (key) => (
                  <Th key={key} ariaSort={sortState(key, sort, dir)}>
                    <SortLink
                      href={href({ ...nextSort(key, sort, dir), page: 1 })}
                      label={SORTABLE[key].label}
                      state={sortState(key, sort, dir)}
                    />
                  </Th>
                ),
              )}
              {/* ステータスは25段階の順序に意味があり、名前で並べても読めない */}
              <Th>現在のステータス</Th>
              <Th ariaSort={sortState("updatedAt", sort, dir)}>
                <SortLink
                  href={href({ ...nextSort("updatedAt", sort, dir), page: 1 })}
                  label={SORTABLE.updatedAt.label}
                  state={sortState("updatedAt", sort, dir)}
                />
              </Th>
              <Th className={actionHeadClass}>
                <span className="sr-only">操作</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  {narrowed ? "条件に一致する申請案件がありません。" : "申請案件がありません。"}
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
                  className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <th
                    scope="row"
                    className="px-4 py-2.5 text-left font-mono font-medium text-slate-900"
                  >
                    {row.projectNumber}
                  </th>
                  <td className="px-4 py-2.5 text-slate-600">{row.companyName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.primaryStaffName}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-slate-600">
                    {formatJst(row.updatedAt)}
                  </td>
                  <td className={actionCellClass}>
                    {/* 編集できない権限に鉛筆を出すと、押せる操作を取り違える */}
                    {canManage ? (
                      <EditLink href={detailHref(row.id)} label={`${row.name} を編集`} />
                    ) : (
                      <Link href={detailHref(row.id)} className={linkClass}>
                        詳細
                        <span className="sr-only">（{row.name}）</span>
                      </Link>
                    )}
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
