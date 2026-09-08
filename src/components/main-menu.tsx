"use client"

import { useEffect, useId, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { CloseIcon, MENU_ICONS, type MenuIconName } from "@/components/icons"
import { NavLink } from "@/components/nav-link"
import { focusRing } from "@/components/ui"

type MenuLink = { href: string; label: string; icon?: MenuIconName }

/**
 * ヘッダーの主要メニュー。左から開くサイドバー。
 *
 * ネイティブの dialog を showModal で開く。フォーカスの閉じ込め・Esc・背面の不活性化・
 * 閉じたあとのフォーカス復帰をブラウザが持つため、自前で組むより壊れにくい。
 *
 * 中身はリンクの集まりなので role="menu" は使わない。
 * あれはアプリケーションメニュー用で、矢印キーでの移動を前提にする。
 */
export function MainMenu({ links }: { links: readonly MenuLink[] }) {
  const [open, setOpen] = useState(false)
  const drawer = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const pathname = usePathname()

  // 画面が変わったら閉じる。開いたまま残ると、次の画面で現在地と食い違う
  useEffect(() => {
    drawer.current?.close()
  }, [pathname])

  return (
    <>
      {/* 三本線だけでは何のボタンか伝わらないので、名前は aria-label で与える */}
      <button
        type="button"
        aria-label="メニュー"
        aria-expanded={open}
        onClick={() => {
          drawer.current?.showModal()
          setOpen(true)
        }}
        className={
          "inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 " +
          focusRing
        }
      >
        <span aria-hidden className="flex flex-col gap-[3px]">
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
          <span className="block h-0.5 w-4 rounded bg-current" />
        </span>
      </button>

      <dialog
        ref={drawer}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        // 背面をクリックしたら閉じる。背面のクリックは dialog 自身が受け取る
        onClick={(event) => {
          if (event.target === drawer.current) drawer.current?.close()
        }}
        className="m-0 mr-auto h-dvh max-h-dvh w-[min(18rem,80vw)] border-r border-slate-200 bg-white p-0 backdrop:bg-slate-900/40"
      >
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-4 px-2">
            <h2 id={titleId} className="text-lg font-bold text-slate-500">
              メニュー
            </h2>
            {/* ×だけでは何のボタンか伝わらないので、名前は aria-label で与える */}
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => drawer.current?.close()}
              className={
                "inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
                focusRing
              }
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex flex-col gap-0.5">
            {links.map((link) => {
              const LinkIcon = link.icon ? MENU_ICONS[link.icon] : null
              return (
                <NavLink key={link.href} href={link.href} size="sidebar">
                  {LinkIcon ? <LinkIcon className="h-5 w-5 text-slate-400" /> : null}
                  {link.label}
                </NavLink>
              )
            })}
          </nav>
        </div>
      </dialog>
    </>
  )
}
