"use client"

import { useId, useRef, useState } from "react"
import { CloseIcon } from "@/components/icons"
import { buttonSecondary, focusRing } from "@/components/ui"

/**
 * アップロードしたファイルを画面内で開く。
 *
 * 扱えるのは PDF と画像だけ（5.2）なので、埋め込み方はこの2通りで足りる。
 * 中身は開いている間だけ読み込む。閉じても残すと、開くたびに増えた分を抱え続ける。
 */
export function FilePreviewDialog({
  url,
  filename,
  contentType,
}: {
  url: string
  filename: string
  contentType: string
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const isImage = contentType.startsWith("image/")

  return (
    <>
      <button
        type="button"
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}
        className={buttonSecondary}
      >
        プレビュー
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="m-auto h-[85vh] w-[min(64rem,calc(100vw-2rem))] rounded-lg border border-slate-200 p-0 text-left backdrop:bg-slate-900/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <h2 id={titleId} className="truncate text-base font-bold">
              {filename}
            </h2>
            {/* ×だけでは何のボタンか伝わらないので、名前は aria-label で与える */}
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => dialog.current?.close()}
              className={
                "inline-flex shrink-0 items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
                focusRing
              }
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 bg-slate-100">
            {!open ? null : isImage ? (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                {/* next/image は署名付きURLと相性が悪い。期限のたびに最適化がやり直しになる */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={filename} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <iframe src={url} title={filename} className="h-full w-full border-0" />
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
