"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { focusRing } from "./ui"

/** ヘッダーのナビゲーション。現在の画面を aria-current と背景色の両方で示す。 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md px-2 py-1 text-sm " +
        (active
          ? "bg-slate-100 font-medium text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900") +
        " " +
        focusRing
      }
    >
      {children}
    </Link>
  )
}
