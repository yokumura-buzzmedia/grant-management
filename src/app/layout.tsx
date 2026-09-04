import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "助成金管理システム",
  description: "助成金の申請案件と研修を管理するシステム",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
