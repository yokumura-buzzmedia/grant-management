"use client"

import { useRef, useState } from "react"
import { focusRing } from "./ui"

export type Tab = {
  id: string
  label: string
  /** 見出しの右に出す件数 */
  count?: number
  panel: React.ReactNode
}

/**
 * タブ切り替え（WAI-ARIA の tabs パターン）。
 *
 * パネルは両方とも描画したまま hidden で隠す。取り外すと、編集途中のフォームの
 * 入力内容がタブを往復しただけで消えてしまう。
 * 矢印キー・Home・End でタブを移動できる。
 */
export function Tabs({
  label,
  tabs,
  defaultTabId,
}: {
  /** タブ一覧そのものの説明。読み上げに使う */
  label: string
  tabs: Tab[]
  defaultTabId?: string
}) {
  const [current, setCurrent] = useState(
    () => tabs.find((tab) => tab.id === defaultTabId)?.id ?? tabs[0]?.id ?? "",
  )
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})

  const select = (id: string) => {
    setCurrent(id)
    buttons.current[id]?.focus()
  }

  const selectAt = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length]
    if (tab) select(tab.id)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((tab) => tab.id === current)
    if (event.key === "ArrowRight") {
      event.preventDefault()
      selectAt(index + 1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      selectAt(index - 1)
    } else if (event.key === "Home") {
      event.preventDefault()
      selectAt(0)
    } else if (event.key === "End") {
      event.preventDefault()
      selectAt(tabs.length - 1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="flex gap-1 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const active = tab.id === current
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[tab.id] = element
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              // 選択中のタブだけを Tab キーの止まる場所にする
              tabIndex={active ? 0 : -1}
              onClick={() => setCurrent(tab.id)}
              className={
                "-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm " +
                (active
                  ? "border-slate-900 font-semibold text-slate-900"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900") +
                " " +
                focusRing
              }
            >
              {tab.label}
              {tab.count === undefined ? null : (
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs tabular-nums " +
                    (active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700")
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => {
        const active = tab.id === current
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={!active}
            className={active ? "flex flex-col gap-6" : undefined}
          >
            {tab.panel}
          </div>
        )
      })}
    </div>
  )
}
