import Link from "next/link"
import type { ProjectStatus } from "@/db/schema"
import { EditLink, Th, actionCellClass, actionHeadClass, buttonSecondary, linkClass } from "@/components/ui"
import { PROJECT_STATUS_LABELS, statusNumber } from "@/lib/projects/status"

/**
 * D-02 会社詳細の申請案件（01_要件定義.md 5.14, 5.15）。
 *
 * 一覧（C-01）と同じ列にそろえるが、会社は決まっているので会社名の列は出さない。
 * 作成と編集は事務員・システム管理者だけ（06_画面設計.md 5 の C-09）。
 * クライアントには行から詳細（C-02）へ入る導線だけを出す。
 */

export type CompanyProject = {
  id: number
  projectNumber: string
  name: string
  status: ProjectStatus
  primaryStaffName: string
  updatedAtText: string
}

export function CompanyProjects({
  companyId,
  projects,
  canManage,
}: {
  companyId: number
  projects: readonly CompanyProject[]
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          この会社の申請案件です。
          <Link href="/projects" className={linkClass}>
            申請案件一覧
          </Link>
          からは、すべての案件を検索できます。
        </p>
        {canManage ? (
          // 会社詳細から作るときは会社が決まっている。選び直させない
          <Link href={`/projects/new?company=${companyId}`} className={buttonSecondary}>
            申請案件を作成
          </Link>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          この会社の申請案件はまだありません。
        </p>
      ) : (
        // relative が要る。sr-only は position:absolute のため、位置指定された祖先が
        // ないと overflow-x-auto の外へ出てしまい、ページ全体が横スクロールする
        <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">この会社の申請案件。全 {projects.length} 件。</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <Th>案件番号</Th>
                <Th>案件名</Th>
                <Th>主担当事務員</Th>
                <Th>現在のステータス</Th>
                <Th>最終更新日時</Th>
                <Th className={actionHeadClass}>
                  <span className="sr-only">操作</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <th
                    scope="row"
                    className="px-4 py-2.5 text-left font-mono font-medium text-slate-900"
                  >
                    {project.projectNumber}
                  </th>
                  <td className="px-4 py-2.5 text-slate-600">{project.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{project.primaryStaffName}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-600">
                        {statusNumber(project.status)}
                      </span>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-slate-600">
                    {project.updatedAtText}
                  </td>
                  <td className={actionCellClass}>
                    {/* 編集できない権限に鉛筆を出すと、押せる操作を取り違える */}
                    {canManage ? (
                      <EditLink href={`/projects/${project.id}`} label={`${project.name} を編集`} />
                    ) : (
                      <Link href={`/projects/${project.id}`} className={linkClass}>
                        詳細
                        <span className="sr-only">（{project.name}）</span>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
