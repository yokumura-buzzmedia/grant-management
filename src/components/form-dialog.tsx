"use client"

import { useId, useRef, useState } from "react"
import { CloseIcon, EditIcon } from "@/components/icons"
import { buttonIcon, buttonPrimary, buttonSecondary, focusRing } from "@/components/ui"

/**
 * 新規作成のフォームを載せるモーダル。
 *
 * ネイティブの dialog を showModal で開く。フォーカスの閉じ込め・Esc・背面の不活性化・
 * 閉じたあとのフォーカス復帰をブラウザが持つため、自前で組むより壊れにくい
 * （ConfirmDialog と同じ土台）。
 *
 * 中身は開いている間だけ描画する。閉じても残すと、前回の入力や作成結果が
 * 次に開いたときそのまま出てくる。
 *
 * 閉じるきっかけは中のフォーム次第になる。
 * 保存後に redirect するアクションは画面遷移でこのダイアログごと消えるため、
 * 結果は背面の通知帯で伝わる。状態を返すだけのアクション（仮パスワードの発行など）は
 * 開いたままになり、結果はこの中に出る。
 */
export function FormDialog({
  triggerLabel,
  triggerDescription,
  triggerVariant = "primary",
  title,
  children,
}: {
  triggerLabel: string
  /**
   * ボタンの読み上げに足す語。
   * 「新規作成」だけでは何を作るのか伝わらないため、対象を読み上げにだけ渡す。
   */
  triggerDescription?: string
  /**
   * primary は新規作成のボタン。secondary は同じ画面に追加の入口が複数あるとき
   * （カリキュラムの各マスタ）に使う。icon は一覧の行に置く鉛筆だけのボタンで、
   * 名前は triggerLabel を aria-label として与える。
   */
  triggerVariant?: "primary" | "secondary" | "icon"
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const open_ = () => {
    dialog.current?.showModal()
    setOpen(true)
  }

  return (
    <>
      {triggerVariant === "icon" ? (
        <button
          type="button"
          aria-label={triggerLabel}
          onClick={open_}
          className={buttonIcon}
        >
          <EditIcon />
        </button>
      ) : (
        <button
          type="button"
          onClick={open_}
          className={triggerVariant === "secondary" ? buttonSecondary : buttonPrimary}
        >
          {triggerLabel}
          {triggerDescription ? <span className="sr-only">（{triggerDescription}）</span> : null}
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // dialog は top layer に出るが、CSS は DOM 上の親を継承する。
        // 一覧の操作列（text-right）の中に置くため、行揃えをここで戻す
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 text-left backdrop:bg-slate-900/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {/* ×だけでは何のボタンか伝わらないので、名前は aria-label で与える */}
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => dialog.current?.close()}
              className={
                "inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
                focusRing
              }
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {/* 入力欄が多いと画面に収まらない。ダイアログごとではなく中身だけを送る */}
          <div className="overflow-y-auto p-6">{open ? children : null}</div>
        </div>
      </dialog>
    </>
  )
}
