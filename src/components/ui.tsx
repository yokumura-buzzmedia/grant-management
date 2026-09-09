import Link from "next/link"
import { EditIcon } from "@/components/icons"

/**
 * 画面をまたいで共有する見た目の定義。
 * 個々の画面で class 文字列を複製すると、フォーカス表現が画面ごとに割れる。
 */

/**
 * キーボード操作時の現在位置。
 * outline-none でブラウザ既定の輪郭を消す場合は、必ずこれを併せて付ける（WCAG 2.4.7）。
 */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"

/** 入力欄・選択欄。幅は使う側で指定する */
export const controlClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 " +
  focusRing

/** 主要な操作。1画面に1つを原則とする */
export const buttonPrimary =
  "inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 " +
  focusRing

/** 副次的な操作 */
export const buttonSecondary =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 " +
  focusRing

/** 枠を持たない操作 */
export const buttonGhost =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
  focusRing

/**
 * 取り消せない操作を開始する。押した先で必ず確認をとる。
 * 実行そのものではないので、塗りつぶしではなく枠線にする。
 */
export const buttonDangerOutline =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 " +
  focusRing

/**
 * 取り消せない操作を確定する。確認ダイアログの中でだけ使う。
 * ここを通常のプライマリと同じ色にすると、いちばん危険な操作がいちばん目立たなくなる。
 */
export const buttonDanger =
  "inline-flex w-full items-center justify-center rounded-md bg-red-700 px-5 py-2.5 text-base font-medium text-white hover:bg-red-800 disabled:opacity-50 " +
  focusRing

/** 文中のリンク。常時下線ではなくホバーで下線を出す */
export const linkClass = "rounded-sm text-slate-600 hover:text-slate-900 hover:underline " + focusRing

/**
 * アイコンだけの操作。名前を持たないので、使う側が aria-label で与える。
 * 一覧の行に置く鉛筆（FormDialog の icon トリガーと EditLink）で共有する。
 */
export const buttonIcon =
  "inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 " +
  focusRing

/**
 * 一覧の右端に固定する操作列。
 *
 * 列が多い表は横スクロールが出るため、編集の入り口が画面の外へ隠れる。
 * 右端に貼り付けて、どこまで横に流しても押せる位置に置く。
 * 背景を敷かないと下を流れる列が透けるので、見出しと本体で色を分ける。
 * 本体はホバーを行に追従させるため、tr 側に group を付けて使う。
 */
export const actionHeadClass =
  "sticky right-0 w-px bg-slate-50 shadow-[inset_1px_0_0_theme(colors.slate.200)]"

export const actionCellClass =
  "sticky right-0 bg-white px-4 py-2.5 text-right shadow-[inset_1px_0_0_theme(colors.slate.200)] group-hover:bg-slate-50"

/**
 * 一覧の行から編集へ入るアイコンリンク。
 *
 * 受講者とクライアントアカウントは編集がモーダル（FormDialog の icon トリガー）、
 * 会社とアカウントは別画面と、開く先は違う。行の右端の鉛筆から入るという操作を
 * そろえたいので、見た目と位置は共通にし、リンクとボタンだけを使い分ける。
 */
export function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className={buttonIcon}>
      <EditIcon />
    </Link>
  )
}

/**
 * 一覧や親画面へ戻る導線。見出しの上に置く。
 * 矢印は装飾なので、読み上げには行き先の名前だけを渡す。
 */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={linkClass + " self-start text-sm"}>
      <span aria-hidden>← </span>
      {children}
    </Link>
  )
}

/**
 * 画面上部の見出し。
 * 画面ID（D-01 など）は設計書との対応を追うための開発者向けの情報なので、画面には出さない。
 * コードから設計書を引くための対応は、各ページの JSDoc に残している。
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** 操作の結果を伝える帯。読み上げは role="status" に任せる */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
      {children}
    </p>
  )
}

/** 並び替えの状態。aria-sort の値をそのまま使う */
export type SortState = "ascending" | "descending" | "none"

/** 一覧テーブルの列見出し。並び替え中の列は aria-sort でも伝える。 */
export function Th({
  children,
  ariaSort,
  className = "",
}: {
  children: React.ReactNode
  ariaSort?: SortState
  className?: string
}) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={"px-4 py-2.5 font-semibold text-slate-700 " + className}
    >
      {children}
    </th>
  )
}

/**
 * 並び替えできる列見出しのリンク。
 * 矢印は並び替え中でない列でも表示し、押せることが分かるようにする。
 *
 * 押すたびに 昇順 → 降順 → 既定 と一巡する。既定へ戻す手段がないと、
 * 一度並べ替えたあとに初期表示順へ戻せなくなるため。
 * 3回目で解除されることは見ただけでは分からないので、
 * マウスでも読み上げでも次の動作が分かるようにしている。
 */
export function SortLink({
  href,
  label,
  state,
}: {
  href: string
  label: string
  state: SortState
}) {
  const hint =
    state === "ascending"
      ? "昇順で並べ替え中。押すと降順になります"
      : state === "descending"
        ? "降順で並べ替え中。押すと既定の並び順に戻ります"
        : "この列で並べ替える"

  return (
    <Link
      href={href}
      title={hint}
      className={"group inline-flex items-center gap-1 rounded-sm hover:text-slate-900 " + focusRing}
    >
      {label}
      <span
        aria-hidden
        className={
          state === "none" ? "text-slate-500 group-hover:text-slate-900" : "text-slate-900"
        }
      >
        {state === "ascending" ? "↑" : state === "descending" ? "↓" : "↕"}
      </span>
      <span className="sr-only">{hint}</span>
    </Link>
  )
}

/** 一覧のページ送り。 */
export function Pagination({
  page,
  lastPage,
  href,
}: {
  page: number
  lastPage: number
  href: (page: number) => string
}) {
  if (lastPage <= 1) return null
  return (
    <nav aria-label="ページ送り" className="flex items-center justify-center gap-2 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonSecondary}>
          前へ
        </Link>
      ) : (
        <span className={buttonSecondary + " cursor-default opacity-40"} aria-hidden>
          前へ
        </span>
      )}
      <span className="px-2 tabular-nums text-slate-600">
        {page} / {lastPage}
      </span>
      {page < lastPage ? (
        <Link href={href(page + 1)} className={buttonSecondary}>
          次へ
        </Link>
      ) : (
        <span className={buttonSecondary + " cursor-default opacity-40"} aria-hidden>
          次へ
        </span>
      )}
    </nav>
  )
}

/**
 * 一覧の絞り込みタブ。
 * 選択中を色だけで示すと、読み上げでは現在位置が伝わらないので aria-current も付ける。
 */
export function FilterChip({
  href,
  current,
  children,
}: {
  href: string
  current: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={
        "inline-flex items-center rounded-md border px-3 py-1.5 text-sm " +
        (current
          ? "border-slate-900 bg-slate-900 font-medium text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50") +
        " " +
        focusRing
      }
    >
      {children}
    </Link>
  )
}

/**
 * 画面を切り替えるタブ。
 *
 * ARIA の tabs パターン（components/tabs.tsx）は、同じ文書の中でパネルを差し替える前提。
 * ここは切り替えが画面遷移になり、並び替えやページ送りのリンクにも状態が乗るので、
 * ボタンではなくリンクにして現在地を aria-current で示す。
 */
export function TabLinks({
  label,
  tabs,
}: {
  /** タブ一覧そのものの説明。読み上げに使う */
  label: string
  tabs: readonly { href: string; label: string; current: boolean; count?: number }[]
}) {
  return (
    <nav aria-label={label} className="flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? "page" : undefined}
          className={
            "-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm " +
            (tab.current
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
                (tab.current ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700")
              }
            >
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}

/**
 * 一覧の件数表示。
 * 画面ごとに書式が割れると、同じ数字を読むのに毎回読み方を切り替えることになる。
 */
export function ResultCount({
  page,
  pageSize,
  count,
}: {
  page: number
  pageSize: number
  count: number
}) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)
  return (
    <p className="text-sm tabular-nums text-slate-600">
      {count === 0 ? "0 件" : `${from}–${to} 件 / 全 ${count} 件`}
    </p>
  )
}

/** フォームの区切り。見出しは中の項目ラベルより強くする */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** 2列に並べる。狭い画面では1列に落ちる */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}
