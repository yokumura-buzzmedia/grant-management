/**
 * 画面で使う線画アイコン。
 *
 * 使う数が少ないのでライブラリは足さず、必要なものだけをここに置く。
 * どれも文字ラベルの補助でしかないので、既定で aria-hidden にして読み上げから外す。
 * 名前が要る場合（アイコンだけのボタンなど）は、外側の button に aria-label を付ける。
 */

type IconProps = { className?: string }

function Icon({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"shrink-0 " + className}
    >
      {children}
    </svg>
  )
}

/** 会社 */
export function BuildingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M5 20.5V4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
      <path d="M14 9.5h4a1 1 0 0 1 1 1v10" />
      <path d="M8 7.5h3M8 11h3M8 14.5h3" />
    </Icon>
  )
}

/** アカウント */
export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 11.25a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75Z" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.375 3.375 0 0 1 0 5.85" />
      <path d="M17.5 14.4a6 6 0 0 1 3 5.1" />
    </Icon>
  )
}

/** 削除履歴 */
export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.75a1.25 1.25 0 0 1 1.25-1.25h2.5a1.25 1.25 0 0 1 1.25 1.25V6.5" />
      <path d="m6.75 6.5.78 12.1a1.5 1.5 0 0 0 1.5 1.4h5.94a1.5 1.5 0 0 0 1.5-1.4l.78-12.1" />
      <path d="M10 10.5v6M14 10.5v6" />
    </Icon>
  )
}

/** 編集 */
export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16.6 3.7a1.6 1.6 0 0 1 2.3 0l1.4 1.4a1.6 1.6 0 0 1 0 2.3L9.1 19.6a1.5 1.5 0 0 1-.7.4l-4 1.1a.5.5 0 0 1-.6-.6l1.1-4a1.5 1.5 0 0 1 .4-.7Z" />
      <path d="m14.8 5.5 3.7 3.7" />
    </Icon>
  )
}

/** 閉じる */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  )
}

/**
 * メニュー項目のアイコン。
 * レイアウト側は名前だけを渡す。JSX を持たせるとサーバーコンポーネントから
 * クライアントコンポーネントへ関数を渡すことになり、境界を越えられない。
 */
export const MENU_ICONS = {
  company: BuildingIcon,
  accounts: UsersIcon,
  deletionLogs: TrashIcon,
} as const

export type MenuIconName = keyof typeof MENU_ICONS
