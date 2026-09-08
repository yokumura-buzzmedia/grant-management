"use client"

import { useState } from "react"
import { DeleteDialog } from "@/components/delete-dialog"
import { FilePreviewDialog } from "@/components/file-preview-dialog"
import { SubmitButton } from "@/components/form"
import { controlClass, linkClass } from "@/components/ui"
import {
  approveContractAction,
  deleteContractAction,
  requestContractUploadAction,
  submitContractAction,
} from "@/lib/contracts/actions"

export type ContractView = {
  status: "submitted" | "approved"
  originalFilename: string
  contentType: string
  /** JST に直した表示用の文字列。サーバー側で作る */
  submittedAtText: string
  approvedAtText: string | null
  /** 署名付きのURL。サーバー側で発行する。保存用と画面内表示用で署名が別 */
  downloadUrl: string
  previewUrl: string
}

/**
 * D-04 受講者ごとの雇用契約書（5.2）。受講者1人につき1ファイル。
 *
 * 50MB のファイルは Server Action のボディ上限を超えるため、サーバーから
 * 署名付きURLを受け取り、ブラウザから保管先へ直接送る（03_技術選定.md 4.6）。
 * 送り終えてからサーバーへファイルキーを登録する。
 */
export function EmploymentContract({
  traineeId,
  companyId,
  contract,
  canManage,
}: {
  traineeId: number
  companyId: number
  /** 未提出なら null */
  contract: ContractView | null
  /** 承認と削除ができるのは事務員とシステム管理者だけ（5.2） */
  canManage: boolean
}) {
  const [error, setError] = useState<string | null>(null)

  const upload = async (formData: FormData) => {
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      setError("ファイルを選んでください。")
      return
    }

    setError(null)

    const ticket = await requestContractUploadAction(traineeId, companyId, file.type, file.size)
    if (!ticket.ok) {
      setError(ticket.error)
      return
    }

    // ここだけはアプリケーションサーバーを経由せず、保管先へ直接送る。
    // Content-Type は署名に含まれているので、発行時と同じ値を必ず付ける
    const response = await fetch(ticket.url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type },
    })
    if (!response.ok) {
      setError("アップロードに失敗しました。時間をおいてもう一度お試しください。")
      return
    }

    // 登録できたら会社詳細へ戻る
    await submitContractAction(traineeId, companyId, {
      key: ticket.key,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-500">雇用契約書</h3>

      {/* 状態と同じ書き方にする。「現在」で始めると他の節と読み比べやすい */}
      <p className="text-sm text-slate-700">
        現在{" "}
        {contract === null ? (
          <span className="font-bold">未提出</span>
        ) : contract.status === "approved" ? (
          "承認済"
        ) : (
          <>
            <span className="font-bold">提出済（承認待ち）</span>
          </>
        )}
      </p>

      {contract ? (
        // ファイルそのものへの操作は、ファイルの情報と同じ帯に置く
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          {/* 一覧側を縮められるようにしないと、ボタンが下の行へ折り返す */}
          <dl className="grid min-w-0 flex-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[5rem_minmax(0,1fr)]">
            <dt className="text-slate-500">ファイル</dt>
            <dd className="min-w-0 break-all">
              <a href={contract.downloadUrl} className={linkClass}>
                {contract.originalFilename}
              </a>
              <span className="ml-2 whitespace-nowrap text-xs text-slate-500">
                （押すと保存します）
              </span>
            </dd>
            <dt className="text-slate-500">提出</dt>
            <dd className="tabular-nums text-slate-700">{contract.submittedAtText}</dd>
            {contract.approvedAtText ? (
              <>
                <dt className="text-slate-500">承認</dt>
                <dd className="tabular-nums text-slate-700">{contract.approvedAtText}</dd>
              </>
            ) : null}
          </dl>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <FilePreviewDialog
              url={contract.previewUrl}
              filename={contract.originalFilename}
              contentType={contract.contentType}
            />
            {/* 削除は承認と同じ権限。差し替えで足りる場面で消させない */}
            {canManage ? (
              <DeleteDialog
                action={deleteContractAction.bind(null, traineeId, companyId)}
                buttonLabel="ファイルを削除"
                title="雇用契約書を削除しますか"
                targetName={contract.originalFilename}
                consequences={[
                  "保管しているファイルを削除します。差し替えではなく未提出の状態に戻ります。",
                  ...(contract.status === "approved"
                    ? ["承認が取り消され、進行中の申請案件はステータスを先へ進められなくなります。"]
                    : []),
                  "削除履歴には記録されません。",
                ]}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form action={upload} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`contract-${traineeId}`} className="mb-1 block text-sm font-medium text-slate-700">
            {contract ? "差し替えるファイル" : "提出するファイル"}
          </label>
          <input
            id={`contract-${traineeId}`}
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className={controlClass + " w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm"}
          />
          <span className="mt-1 block text-xs text-slate-500">
            PDF・JPEG・PNG、50MBまで。
            {contract?.status === "approved"
              ? "差し替えると承認が取り消され、事務員の再承認が必要になります"
              : "受講者1人につき1ファイルです"}
          </span>
        </div>
        {/* 送信中の表示は useFormStatus が持つ。フォームのアクションとして走らせている */}
        <SubmitButton variant="secondary" fullWidth={false}>
          {contract ? "差し替える" : "提出する"}
        </SubmitButton>
      </form>

      {/* 承認は書類の状態を進める操作なので、ファイルへの操作とは分けて下に置く */}
      {canManage && contract?.status === "submitted" ? (
        <div>
          <form action={approveContractAction.bind(null, traineeId, companyId)}>
            <SubmitButton fullWidth={false}>承認する</SubmitButton>
          </form>
        </div>
      ) : null}
    </section>
  )
}
