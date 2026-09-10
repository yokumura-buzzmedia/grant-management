import Link from "next/link"
import { ProjectStatusForm } from "@/components/project-status-form"
import { linkClass } from "@/components/ui"
import type { ProjectStatus } from "@/db/schema"
import {
  nextStatus,
  phaseIndex,
  PROJECT_PHASES,
  PROJECT_STATUS_LABELS,
  statusNumber,
} from "@/lib/projects/status"

/**
 * C-02 のステータス（01_要件定義.md 5.1 / 06_画面設計.md C-02）。
 *
 * 24段階は数が多く、番号と名前だけでは全体のどこにいるのか掴めない。
 * 業務フェーズ（ダッシュボードの集計単位）の帯を出して、残りがどれだけあるかを見せる。
 *
 * 帯は現在地の言い換えでしかないので、読み上げには渡さない。
 * 同じことを2度読み上げても位置は伝わらない。位置は下の文で伝える。
 */
export function ProjectStatusControl({
  projectId,
  companyId,
  status,
  canChange,
  canCorrect,
  blockers,
}: {
  projectId: number
  /** 前提条件の解消先（会社情報・受講者）へ案内するために使う */
  companyId: number
  status: ProjectStatus
  /** 事務員とシステム管理者だけが変更できる */
  canChange: boolean
  /** 順序を外れた変更（誤操作の修正）を許すか。システム管理者だけ */
  canCorrect: boolean
  /** 次へ進めない理由。空なら進める */
  blockers: string[]
}) {
  const target = nextStatus(status)
  const current = phaseIndex(status)
  const inquiry = status === "inquiry"

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-base font-bold text-slate-900">ステータス</h2>

      <div className="flex flex-col gap-2">
        <p className="text-lg font-bold text-slate-900">
          {statusNumber(status)}. {PROJECT_STATUS_LABELS[status]}
        </p>

        {/* 進み具合の帯。フェーズ名は幅が足りないと出せないので、位置は下の文で必ず出す */}
        <ol aria-hidden className="flex gap-1">
          {PROJECT_PHASES.map((phase, index) => (
            <li
              key={phase.name}
              className={
                "h-1.5 flex-1 rounded-full " +
                (inquiry
                  ? "bg-amber-400"
                  : index < current
                    ? "bg-slate-400"
                    : index === current
                      ? "bg-slate-900"
                      : "bg-slate-200")
              }
            />
          ))}
        </ol>

        <p className="text-xs text-slate-600">
          {inquiry ? (
            "完了後の問い合わせ対応中です。対応が終わったら「完了」へ戻します。"
          ) : (
            <>
              <span className="font-medium text-slate-900">
                {PROJECT_PHASES[current]?.name}
              </span>
              （{PROJECT_PHASES.length}フェーズ中 {current + 1} 番目）／ 全24段階のうち{" "}
              {statusNumber(status)} 番目
            </>
          )}
        </p>

        {target ? (
          <p className="text-xs text-slate-600">
            次は{" "}
            <span className="font-medium text-slate-900">
              {statusNumber(target)}. {PROJECT_STATUS_LABELS[target]}
            </span>{" "}
            です。
          </p>
        ) : null}
      </div>

      {canChange ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          {blockers.length > 0 ? (
            <div className="rounded-md bg-slate-100 p-3 text-xs text-slate-700">
              <p className="font-bold">
                {target ? `${PROJECT_STATUS_LABELS[target]} へ進むには次の対応が必要です` : ""}
              </p>
              <ul className="mt-1 list-inside list-disc">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
              <p className="mt-2">
                <Link href={`/companies/${companyId}`} className={linkClass}>
                  会社詳細
                </Link>
                で会社情報・受講者・雇用契約書を確認してください。
              </p>
            </div>
          ) : null}

          <ProjectStatusForm
            projectId={projectId}
            status={status}
            canCorrect={canCorrect}
            blockers={blockers}
          />
        </div>
      ) : null}
    </section>
  )
}
