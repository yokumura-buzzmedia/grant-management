"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { focusRing } from "./ui"

/**
 * 余白と文字サイズ。
 * Tailwind は同じ種類のクラスを並べても後勝ちにならない（出力順で決まる）ので、
 * 呼び出し側から上書きさせず、ここで組を選ばせる。
 */
const NAV_SIZES = {
  /** ヘッダーの導線 */
  header: "gap-2 px-2 py-1 text-sm",
  /** サイドバーの主要メニュー。主たる移動手段なので大きく取る */
  sidebar: "gap-3 px-3 py-2 text-lg",
} as const

/** ヘッダーのナビゲーション。現在の画面を aria-current と背景色の両方で示す。 */
export function NavLink({
  href,
  children,
  size = "header",
  className = "",
}: {
  href: string
  children: React.ReactNode
  size?: keyof typeof NAV_SIZES
  className?: string
}) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "flex items-center rounded-md " +
        NAV_SIZES[size] +
        " " +
        (active
          ? "bg-slate-100 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900") +
        " " +
        focusRing +
        (className ? " " + className : "")
      }
    >
      {children}
    </Link>
  )
}
