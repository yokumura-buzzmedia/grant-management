"use client"

import { useEffect, useId, useRef } from "react"
import { SubmitButton } from "@/components/form"
import { buttonDangerOutline, buttonSecondary } from "@/components/ui"

/**
 * 取り消しにくい操作の確認ダイアログ。
 *
 * 何が起きるかは、常時画面に置くのではなくここに集める。
 * 画面に出しっぱなしにすると読み飛ばされるうえ、操作の数だけ説明文が積み上がる。
 *
 * ネイティブの dialog を使う。フォーカスの閉じ込め・Esc・背面の不活性化を
 * ブラウザが持つため、自前で組むより壊れにくい。
 */
export function ConfirmDialog({
  action,
  triggerLabel,
  triggerVariant = "secondary",
  title,
  description,
  consequences,
  confirmLabel,
  confirmVariant = "primary",
  closeToken,
  children,
}: {
  /** 確定時に実行する。サーバーアクションでも useActionState の formAction でもよい */
  action: (formData: FormData) => void | Promise<void>
  triggerLabel: string
  triggerVariant?: "secondary" | "danger"
  title: string
  /** 何をしようとしているかの一文 */
  description: React.ReactNode
  /** 実行すると何が起きるか */
  consequences: string[]
  confirmLabel: string
  confirmVariant?: "primary" | "danger"
  /**
   * 値が変わったら閉じる。
   * 画面遷移しないアクションで、結果をダイアログの外に見せるときに使う。
   */
  closeToken?: string | number
  /** 実行結果のエラーなど、ボタンの手前に出すもの */
  children?: React.ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const consequenceId = `${titleId}-consequences`
  const seenToken = useRef(closeToken)

  useEffect(() => {
    if (closeToken === seenToken.current) return
    seenToken.current = closeToken
    if (closeToken !== undefined) dialog.current?.close()
  }, [closeToken])

  const danger = confirmVariant === "danger"

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={triggerVariant === "danger" ? buttonDangerOutline : buttonSecondary}
      >
        {triggerLabel}
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
          <p className="text-sm">{description}</p>

          <ul
            id={consequenceId}
            className={
              "list-inside list-disc rounded-md p-3 text-sm " +
              (danger ? "bg-red-50 text-red-900" : "bg-slate-100 text-slate-700")
            }
          >
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          {children}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={buttonSecondary}
            >
              やめる
            </button>
            <form action={action} className="min-w-[10rem]">
              <SubmitButton variant={confirmVariant}>{confirmLabel}</SubmitButton>
            </form>
          </div>
        </div>
      </dialog>
    </>
  )
}
