"use client"

import { useEffect, useRef } from "react"

/**
 * 保存していない編集を持ったまま画面を離れようとしたときに引き止める。
 * 置いた <form> の編集状態を見るので、フォームの内側に置く。
 *
 * beforeunload だけでは足りない。拾えるのは再読み込み・タブを閉じる・
 * アドレス欄からの移動までで、画面内のリンクは Next.js のクライアント遷移になり発火しない。
 * そのためリンクのクリックを capture 段階で横取りして、自前で確認する。
 *
 * ログアウトのようなフォーム送信は対象外。利用者が明示的に選んだ操作のため引き止めない。
 */
export function UnsavedChangesGuard({
  message = "保存していない変更があります。このまま移動すると変更は失われます。",
}: {
  message?: string
}) {
  const dirty = useRef(false)
  const host = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const form = host.current?.closest("form")
    if (!form) return

    const markDirty = () => {
      dirty.current = true
    }
    const clear = () => {
      dirty.current = false
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return
      event.preventDefault()
      // 古いブラウザはこちらを見る。文言は指定できず、ブラウザ既定の文が出る
      event.returnValue = ""
    }

    const handleClick = (event: MouseEvent) => {
      if (!dirty.current || event.defaultPrevented) return
      // 新しいタブで開く操作は今の画面を離れないので引き止めない
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return
      // フォーム内のリンクは画面を離れないので対象外
      if (form.contains(anchor)) return

      if (window.confirm(message)) {
        clear()
        return
      }
      event.preventDefault()
      event.stopPropagation()
    }

    form.addEventListener("input", markDirty)
    form.addEventListener("change", markDirty)
    form.addEventListener("submit", clear)
    window.addEventListener("beforeunload", handleBeforeUnload)
    // リンクの既定動作より先に判断したいので capture 段階で受ける
    document.addEventListener("click", handleClick, true)

    return () => {
      form.removeEventListener("input", markDirty)
      form.removeEventListener("change", markDirty)
      form.removeEventListener("submit", clear)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleClick, true)
    }
  }, [message])

  return <span ref={host} hidden />
}
