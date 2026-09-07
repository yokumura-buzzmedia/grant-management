"use client"

import { useId, useRef } from "react"
import { SubmitButton } from "@/components/form"
import { buttonDangerOutline, buttonSecondary } from "@/components/ui"

/**
 * 完全削除の確認ダイアログ（06_画面設計.md 2.4）。
 * 削除理由は求めない。実行すると復元できない。
 */
export function DeleteDialog({
  action,
  title,
  targetName,
  consequences,
  buttonLabel = "完全に削除する",
}: {
  action: () => Promise<void>
  title: string
  targetName: string
  /** 削除で一緒に消えるものの説明 */
  consequences: string[]
  buttonLabel?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const consequenceId = `${titleId}-consequences`

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={buttonDangerOutline}
      >
        {buttonLabel}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={consequenceId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 backdrop:bg-slate-900/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-base font-bold">
            {title}
          </h2>
          <p className="text-sm">
            <span className="font-medium">{targetName}</span> を完全に削除します。
          </p>

          <ul
            id={consequenceId}
            className="list-inside list-disc rounded-md bg-red-50 p-3 text-sm text-red-900"
          >
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>削除後は復元できません。</li>
          </ul>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={buttonSecondary}
            >
              やめる
            </button>
            {/* いちばん危険な操作なので、通常のプライマリと同じ色にはしない */}
            <form action={action} className="min-w-[10rem]">
              <SubmitButton variant="danger">{buttonLabel}</SubmitButton>
            </form>
          </div>
        </div>
      </dialog>
    </>
  )
}
