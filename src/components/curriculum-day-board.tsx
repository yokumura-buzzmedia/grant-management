"use client"

import { useOptimistic, useState, useTransition } from "react"

/**
 * 開催パターンの日程（01_要件定義.md 5.7）。
 *
 * 講義コマのカードをドラッグして、日をまたいで動かし、日の中の順も入れ替える。
 * 割当はパターンとコースの組ごとに持つので、ここで動かしても他のコース・
 * 他の開催パターンの日程は変わらない。
 *
 * ドラッグはマウスだけの手段で、タッチ端末では動かず、キーボードでも操作できない。
 * 同じことができる「日程を変更」のダイアログを必ず併置すること。ここを唯一の
 * 導線にすると、その2つの環境では日程を組めなくなる。
 *
 * カードの中身はサーバー側で組んだものを受け取る。編集ダイアログがサーバーアクションを
 * 束ねているため、こちらで組み直すとその繋がりが切れる。
 */

export type BoardItem = {
  id: number
  /** 何日目か。まだどの日にも入っていないコマは null */
  day: number | null
  sessionSymbol: string
  durationHours: number
  card: React.ReactNode
}

/** 0.5時間単位。1.0 は「1時間」と出す */
const hours = (value: number) => `${Number(value.toFixed(1))}時間`

export function CurriculumDayBoard({
  dayCount,
  items,
  onArrange,
}: {
  dayCount: number
  items: BoardItem[]
  /** その日の並びを丸ごと保存する。画面遷移はせず、再描画で確定する */
  onArrange: (dayNumber: number, sessionIds: number[]) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  const [optimistic, apply] = useOptimistic(items, (_state, next: BoardItem[]) => next)
  /** 掴んでいるコマ、いま上にある日、差し込み先のカード */
  const [dragging, setDragging] = useState<number | null>(null)
  const [overDay, setOverDay] = useState<number | null>(null)
  const [overCard, setOverCard] = useState<number | null>(null)

  const clear = () => {
    setDragging(null)
    setOverDay(null)
    setOverCard(null)
  }

  /**
   * 掴んだコマを day の beforeId の手前へ入れる。beforeId が null なら末尾。
   * 表示は配列の並びがそのまま順になる。保存もこの並びをそのまま送る。
   */
  const arrange = (draggedId: number, day: number, beforeId: number | null) => {
    if (draggedId === beforeId) return
    const dragged = optimistic.find((item) => item.id === draggedId)
    if (!dragged) return

    const rest = optimistic.filter((item) => item.id !== draggedId)
    const inDay = rest.filter((item) => item.day === day)
    const outside = rest.filter((item) => item.day !== day)

    const found = beforeId === null ? -1 : inDay.findIndex((item) => item.id === beforeId)
    const at = found < 0 ? inDay.length : found
    const nextDay = [...inDay.slice(0, at), { ...dragged, day }, ...inDay.slice(at)]

    const before = optimistic.filter((item) => item.day === day).map((item) => item.id)
    const after = nextDay.map((item) => item.id)
    if (before.length === after.length && before.every((id, index) => id === after[index])) return

    startTransition(async () => {
      apply([...outside, ...nextDay])
      await onArrange(day, after)
    })
  }

  const unassigned = optimistic.filter((item) => item.day === null)
  const days = Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
    const entries = optimistic.filter((item) => item.day === day)
    return {
      day,
      entries,
      hours: entries.reduce((sum, item) => sum + item.durationHours, 0),
    }
  })

  /** カードは掴む側でもあり、落とす側でもある。落とすとそのカードの手前に入る */
  const cardProps = (item: BoardItem, day: number | null) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.setData("text/plain", String(item.id))
      event.dataTransfer.effectAllowed = "move"
      setDragging(item.id)
    },
    onDragEnd: clear,
    onDragOver:
      day === null
        ? undefined
        : (event: React.DragEvent) => {
            // 既定では drop できない。止めてはじめて落とせる場所になる
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = "move"
            setOverDay(day)
            setOverCard(item.id)
          },
    onDrop:
      day === null
        ? undefined
        : (event: React.DragEvent) => {
            event.preventDefault()
            // 日の側の drop まで届くと、末尾へ入れる方が動いてしまう
            event.stopPropagation()
            const id = Number(event.dataTransfer.getData("text/plain"))
            clear()
            if (Number.isInteger(id)) arrange(id, day, item.id)
          },
    className:
      "flex cursor-grab flex-col gap-2 rounded-md border p-4 active:cursor-grabbing " +
      (dragging === item.id
        ? "border-slate-400 opacity-50 "
        : overCard === item.id
          ? "border-slate-300 shadow-[-3px_0_0_theme(colors.slate.900)] "
          : "border-slate-200 "),
  })

  /** 日の余白へ落としたときは末尾へ付ける */
  const dayProps = (day: number) => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setOverDay(day)
      setOverCard(null)
    },
    onDragLeave: (event: React.DragEvent) => {
      // 中の要素へ移っただけのときは外れていない
      if (event.currentTarget.contains(event.relatedTarget as Node)) return
      setOverDay((current) => (current === day ? null : current))
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      const id = Number(event.dataTransfer.getData("text/plain"))
      clear()
      if (Number.isInteger(id)) arrange(id, day, null)
    },
  })

  return (
    <div className={pending ? "flex flex-col gap-5 opacity-60" : "flex flex-col gap-5"}>
      {unassigned.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-amber-900">未割当</h3>
            <p className="text-sm text-amber-900">{unassigned.length} コマ</p>
          </div>
          <p className="text-sm text-slate-600">
            この開催パターンで、どの日にも入っていない講義コマです。日へドラッグするか、
            「日程を変更」から日を決めてください。
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unassigned.map((item) => (
              <li key={item.id} {...cardProps(item, null)}>
                {item.card}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {days.map(({ day, entries, hours: dayHours }) => (
        <section
          key={day}
          {...dayProps(day)}
          className={
            "flex flex-col gap-3 rounded-lg border bg-white p-6 " +
            (overDay === day ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200")
          }
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">{day} 日目</h3>
            <p className="text-sm text-slate-500">
              {entries.length} コマ ／ {hours(dayHours)}
            </p>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">
              この日に割り当てられた講義コマがありません。ここへドラッグすると移せます。
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((item) => (
                <li key={item.id} {...cardProps(item, day)}>
                  {item.card}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
