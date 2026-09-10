import { notFound } from "next/navigation"
import { alias } from "drizzle-orm/mysql-core"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, projects, userRoles, users } from "@/db/schema"
import { DeleteDialog } from "@/components/delete-dialog"
import { ProjectEditForm } from "@/components/project-edit-form"
import { ProjectStatusControl } from "@/components/project-status-control"
import { BackLink, linkClass, Notice, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"
import { formatJst } from "@/lib/datetime"
import { deleteProjectAction } from "@/lib/projects/actions"
import { nextStatus, PROJECT_STATUS_LABELS, statusNumber } from "@/lib/projects/status"
import { findTransitionBlockers } from "@/lib/projects/transition"
import Link from "next/link"

/**
 * C-02 案件詳細 / 基本情報タブ（01_要件定義.md 5.16, 5.17）。
 *
 * 見える範囲は一覧と同じ（06_画面設計.md 5）。編集と削除は事務員・システム管理者だけ。
 *
 * ステータスの操作は 5.1 のルールどおり「次へ1つ進める」だけを置く。
 * 各段階へ進む条件は要件定義の第6章で未確定だが、要件が確定している前提条件は
 * transition.ts で検査し、満たさない理由をここに出す。
 *
 * 必要書類・契約書・見積・予約・出欠・掲示板のタブ（C-03〜C-08）は未実装のため、
 * タブそのものを出していない。
 */

const NOTICES: Record<string, string> = {
  saved: "保存しました。",
  statusChanged: "ステータスを変更しました。",
}

const ERRORS: Record<string, string> = {
  stale: "ほかの利用者がステータスを変更したため、実行しませんでした。表示を確認して、もう一度お試しください。",
  blocked: "前提条件を満たしていないため、ステータスを変更できませんでした。",
  outOfOrder:
    "順序を外れた変更はできません。ステータスは1つずつ順番に進めます。誤操作の取り消しは、システム管理者に依頼してください。",
  invalidStatus: "ステータスを選び直してください。",
  sameStatus: "現在と同じステータスが選ばれています。",
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireRoles(["client", "staff", "advisor", "agency", "admin"])
  const { id } = await params
  const projectId = Number(id)
  if (!Number.isInteger(projectId) || projectId <= 0) notFound()

  const query = await searchParams
  const raw = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : undefined
  const notice = raw("notice")
  const error = raw("error")

  const canManage = user.roles.includes("staff") || user.roles.includes("admin")
  const canSeeAll = canManage || user.roles.includes("advisor")
  // 一覧と同じ絞り込み。会社や代理店が紐づいていないときは見せない
  const scope = canSeeAll
    ? undefined
    : user.roles.includes("client")
      ? user.companyId
        ? eq(projects.companyId, user.companyId)
        : sql`1 = 0`
      : user.agencyId
        ? eq(companies.referralAgencyId, user.agencyId)
        : sql`1 = 0`

  const createdBy = alias(users, "created_by_user")
  const updatedBy = alias(users, "updated_by_user")

  const [project] = await db
    .select({
      id: projects.id,
      projectNumber: projects.projectNumber,
      name: projects.name,
      status: projects.status,
      companyId: projects.companyId,
      companyName: companies.name,
      primaryStaffId: projects.primaryStaffId,
      primaryStaffName: projects.primaryStaffName,
      createdAt: projects.createdAt,
      createdByName: createdBy.displayName,
      updatedAt: projects.updatedAt,
      updatedByName: updatedBy.displayName,
    })
    .from(projects)
    .innerJoin(companies, eq(companies.id, projects.companyId))
    .leftJoin(createdBy, eq(createdBy.id, projects.createdBy))
    .leftJoin(updatedBy, eq(updatedBy.id, projects.updatedBy))
    .where(and(eq(projects.id, projectId), scope))
    .limit(1)
  // 権限の外は「無い」として扱う。存在だけが漏れないようにする
  if (!project) notFound()

  const staffRows = canManage
    ? await db
        .selectDistinct({ id: users.id, displayName: users.displayName })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .where(and(eq(users.isActive, true), inArray(userRoles.role, ["staff", "admin"])))
        .orderBy(asc(users.displayName))
    : []

  // 進められない理由は開いた時点で出す（06_画面設計.md C-02）。
  // 進める権限が無い利用者には理由を出しても意味がないので引かない
  const target = canManage ? nextStatus(project.status) : null
  const blockers = target ? await findTransitionBlockers(target, project.companyId) : []

  // 一覧の絞り込みを保ったまま戻る
  const listQuery = new URLSearchParams()
  for (const key of ["q", "status", "staff", "sort", "dir", "page"]) {
    const value = raw(key)
    if (value) listQuery.set(key, value)
  }
  const backHref = listQuery.toString() ? `/projects?${listQuery}` : "/projects"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={backHref}>申請案件一覧</BackLink>
        <PageHeader
          title={project.name}
          description={[
            `案件番号 ${project.projectNumber}`,
            project.companyName,
            `${statusNumber(project.status)}. ${PROJECT_STATUS_LABELS[project.status]}`,
          ].join(" ／ ")}
        />
      </div>

      {notice && NOTICES[notice] ? <Notice>{NOTICES[notice]}</Notice> : null}
      {error && ERRORS[error] ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {ERRORS[error]}
        </p>
      ) : null}

      <ProjectStatusControl
        projectId={project.id}
        companyId={project.companyId}
        status={project.status}
        canChange={canManage}
        canCorrect={user.roles.includes("admin")}
        blockers={blockers}
      />

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">基本情報</h2>
        {canManage ? (
          <ProjectEditForm
            projectId={project.id}
            projectNumber={project.projectNumber}
            companyName={project.companyName}
            name={project.name}
            primaryStaffId={project.primaryStaffId}
            staff={staffRows.map((row) => ({ value: String(row.id), label: row.displayName }))}
          />
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm font-medium text-slate-500">案件番号</dt>
            <dd className="font-mono text-sm text-slate-900">{project.projectNumber}</dd>
            <dt className="text-sm font-medium text-slate-500">会社</dt>
            <dd className="text-sm text-slate-900">{project.companyName}</dd>
            <dt className="text-sm font-medium text-slate-500">案件名</dt>
            <dd className="text-sm text-slate-900">{project.name}</dd>
            <dt className="text-sm font-medium text-slate-500">主担当の事務員</dt>
            <dd className="text-sm text-slate-900">{project.primaryStaffName}</dd>
          </dl>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">更新情報</h2>
        {/* 変更前後の内容は保存しない。最新の作成・更新だけを出す（5.17） */}
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm font-medium text-slate-500">作成</dt>
          <dd className="text-sm text-slate-900">
            {formatJst(project.createdAt)} ／ {project.createdByName ?? "—"}
          </dd>
          <dt className="text-sm font-medium text-slate-500">最終更新</dt>
          <dd className="text-sm text-slate-900">
            {formatJst(project.updatedAt)} ／ {project.updatedByName ?? "—"}
          </dd>
        </dl>
        {canManage ? (
          <p className="text-xs text-slate-600">
            会社情報は
            <Link href={`/companies/${project.companyId}`} className={linkClass}>
              会社詳細
            </Link>
            から変更します。
          </p>
        ) : null}
      </section>

      {canManage ? (
        <section className="flex flex-col gap-3 rounded-lg border border-red-200 bg-white p-6">
          <h2 className="text-base font-bold text-red-700">申請案件の削除</h2>
          {/* 影響の内訳は確認ダイアログが持つ。ここで先に並べると二重になる */}
          <div>
            <DeleteDialog
              action={deleteProjectAction.bind(null, project.id)}
              title="申請案件を完全に削除しますか"
              targetName={`${project.projectNumber}　${project.name}`}
              consequences={[
                "この案件の書類・予約・チーム・掲示板投稿もすべて削除されます。",
                "会社情報・クライアントアカウント・受講者は残ります。",
                "削除履歴に「案件番号」「会社名」「削除した利用者」「削除日時」が残ります。",
              ]}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
