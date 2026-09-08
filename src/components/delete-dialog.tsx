"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"

/**
 * 完全削除の確認ダイアログ（06_画面設計.md 2.4）。
 * 削除理由は求めない。実行すると復元できない。
 */
export function DeleteDialog({
  action,
  title,
  targetName,
  consequences,
  buttonLabel = "完全に削除する",
}: {
  action: () => Promise<void>
  title: string
  targetName: string
  /** 削除で一緒に消えるものの説明 */
  consequences: string[]
  buttonLabel?: string
}) {
  return (
    <ConfirmDialog
      action={action}
      triggerLabel={buttonLabel}
      triggerVariant="danger"
      title={title}
      description={
        <>
          <span className="font-medium">{targetName}</span> を完全に削除します。
        </>
      }
      consequences={[...consequences, "削除後は復元できません。"]}
      confirmLabel={buttonLabel}
      confirmVariant="danger"
    />
  )
}
