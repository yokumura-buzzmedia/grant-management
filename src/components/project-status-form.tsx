"use client"

import { useId, useRef, useState } from "react"
import { SubmitButton } from "@/components/form"
import { buttonPrimary, buttonSecondary, controlClass } from "@/components/ui"
import type { ProjectStatus } from "@/db/schema"
import { changeProjectStatusAction } from "@/lib/projects/actions"
import {
  nextStatus,
  PROJECT_STATUS_GROUPS,
  PROJECT_STATUS_LABELS,
  statusNumber,
} from "@/lib/projects/status"

/** 番号付きの表示名。会話でも画面でも番号で指すため、常に番号を添える */
const withNumber = (status: ProjectStatus) =>
  `${statusNumber(status)}. ${PROJECT_STATUS_LABELS[status]}`

/**
 * ステータスの変更（01_要件定義.md 5.1）。
 *
 * 選択肢には25段階すべてを業務フェーズごとに並べる。全体の流れの中で
 * いまどこにいて次がどこかを、選択肢の並びだけで読めるようにするため。
 * ただし選べるのは次の1つだけで、残りは選択不可にする。
 * 並べないと流れが見えず、そのまま選べると順序どおりに進む決まりが崩れる。
 *
 * システム管理者だけは、誤操作の取り消しのためにどこへでも変更できる。
 *
 * 変更は取り消しにくいので、選んだだけでは実行しない。確認をとってから送る。
 * ダイアログはこのフォームの中に置き、選んだ値がそのまま送信されるようにする。
 */
export function ProjectStatusForm({
  projectId,
  status,
  canCorrect,
  blockers,
}: {
  projectId: number
  status: ProjectStatus
  /** 順序を外れた変更を許すか。システム管理者だけ */
  canCorrect: boolean
  /** 次へ進めない理由。空なら進める */
  blockers: string[]
}) {
  const [value, setValue] = useState<ProjectStatus>(status)
  const dialog = useRef<HTMLDialogElement>(null)
  const selectId = useId()
  const titleId = useId()
  const consequenceId = `${titleId}-consequences`

  const target = nextStatus(status)
  const blocked = blockers.length > 0

  /**
   * 現在値は選び直せるように残す。次の1つは前提条件を満たすときだけ。
   * それ以外はシステム管理者の修正でしか選べない。
   */
  const canSelect = (candidate: ProjectStatus) =>
    candidate === status ? true : candidate === target ? !blocked : canCorrect

  const changed = value !== status
  const outOfOrder = changed && value !== target
  // 完了と問い合わせの往復だけは戻せる。それ以外の前進は戻せない
  const reversible = status === "completed" || status === "inquiry"

  const consequences = outOfOrder
    ? [
        "順序を飛ばした変更です。誤操作を取り消すとき以外は行わないでください。",
        "前提条件は確認しません。",
        "最終更新日時と最終更新者が更新されます。",
      ]
    : reversible
      ? [
          status === "completed"
            ? "対応が終わったら「完了」へ戻せます。"
            : "問い合わせが再び発生したときは、もう一度「問い合わせ」へ変更できます。",
          "最終更新日時と最終更新者が更新されます。",
        ]
      : [
          "前のステータスへは戻せません。",
          "誤って進めた場合は、システム管理者だけが修正できます。",
          "最終更新日時と最終更新者が更新されます。",
        ]

  return (
    <form action={changeProjectStatusAction.bind(null, projectId)} className="flex flex-col gap-3">
      {/* 開いたままの画面から、別の利用者が進めたあとの古い遷移を実行させない */}
      <input type="hidden" name="current" value={status} />

      <div className="flex flex-col gap-2">
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          ステータスを変更
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            id={selectId}
            name="status"
            value={value}
            onChange={(event) => setValue(event.target.value as ProjectStatus)}
            className={controlClass + " w-full sm:w-96"}
          >
            {PROJECT_STATUS_GROUPS.map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.statuses.map((candidate) => (
                  <option key={candidate} value={candidate} disabled={!canSelect(candidate)}>
                    {withNumber(candidate)}
                    {candidate === status ? "（現在）" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            disabled={!changed}
            onClick={() => dialog.current?.showModal()}
            className={buttonPrimary}
          >
            変更する
          </button>
        </div>
        <p className="text-xs text-slate-600">
          {canCorrect
            ? "順序どおりに進むのは次の1つだけです。ほかは誤操作を取り消すための修正で、通常の進行では使いません。"
            : "選べるのは次の1つだけです。前のステータスへは戻せません。"}
        </p>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={consequenceId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 backdrop:bg-slate-900/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-base font-bold">
            {PROJECT_STATUS_LABELS[value]} へ変更しますか
          </h2>
          <p className="text-sm">
            <span className="font-medium">{withNumber(status)}</span> から{" "}
            <span className="font-medium">{withNumber(value)}</span> へ変更します。
          </p>

          <ul
            id={consequenceId}
            className={
              "list-inside list-disc rounded-md p-3 text-sm " +
              (outOfOrder ? "bg-red-50 text-red-900" : "bg-slate-100 text-slate-700")
            }
          >
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={buttonSecondary}
            >
              やめる
            </button>
            <div className="min-w-[10rem]">
              <SubmitButton variant={outOfOrder ? "danger" : "primary"}>
                {PROJECT_STATUS_LABELS[value]} にする
              </SubmitButton>
            </div>
          </div>
        </div>
      </dialog>
    </form>
  )
}
