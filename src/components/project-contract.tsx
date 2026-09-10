"use client"

import { useActionState } from "react"
import Link from "next/link"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ErrorList } from "@/components/form"
import { linkClass } from "@/components/ui"
import { EMPTY_STATE } from "@/lib/auth/form-state"
import type { FreeeSignMode } from "@/lib/freee-sign"
import { sendContractAction } from "@/lib/projects/contract"

/**
 * C-04 案件詳細 / 契約書タブ（01_要件定義.md 5.8 / 05_外部連携仕様.md 3.6）。
 *
 * 契約書は freeeサインのテンプレートから生成する。本システムでPDFを作らないので、
 * ここに出るのは「どこへ送ったか」と「いつ送ったか」だけになる。
 *
 * 送付先は会社情報の担当者メールアドレス。**画面で選ばせない。**
 * 選ばせると、契約書が誰に届いたのかが案件ごとにばらける。
 *
 * 送付は取り消しにくい（相手にメールが届く）ので確認をとる。
 * 失敗の理由は相手側の都合で変わるため、コード化せずそのまま出す。
 */
export function ProjectContract({
  projectId,
  companyId,
  contactEmail,
  sentAtLabel,
  documentId,
  concluded,
  canceled,
  mode,
  missingSettings,
  canSend,
}: {
  projectId: number
  /** 担当者メールアドレスの入力先へ案内する */
  companyId: number
  contactEmail: string | null
  /** 送付日時（JST表記済み）。未送付なら null */
  sentAtLabel: string | null
  documentId: number | null
  concluded: boolean
  canceled: boolean
  mode: FreeeSignMode
  /** live で足りない環境変数。連携を有効にできない理由として出す */
  missingSettings: string[]
  /** 事務員とシステム管理者だけ */
  canSend: boolean
}) {
  const [state, formAction] = useActionState(sendContractAction.bind(null, projectId), EMPTY_STATE)

  const unavailable =
    mode === "unconfigured"
      ? "freeeサイン連携がこの環境で設定されていないため、送付できません。"
      : mode === "live" && missingSettings.length > 0
        ? `freeeサインの設定が足りません（${missingSettings.join(", ")}）。`
        : null

  const sent = sentAtLabel !== null && !canceled

  return (
    <div className="flex flex-col gap-5">
      {mode === "mock" ? (
        // クレデンシャルを置かないローカル用（05_外部連携仕様.md 3.12）
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          この環境はモードが <span className="font-mono">mock</span> です。freeeサインを呼ばず、
          <span className="font-bold">メールは実際には送られません。</span>
        </p>
      ) : null}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
        <dt className="text-sm font-medium text-slate-500">状態</dt>
        <dd className="text-sm text-slate-900">
          {concluded
            ? "締結済み"
            : sent
              ? "送付済み・署名待ち"
              : canceled
                ? "送付取消済み"
                : "未送付"}
        </dd>

        <dt className="text-sm font-medium text-slate-500">送付先</dt>
        <dd className="text-sm text-slate-900">
          {contactEmail ?? (
            <span className="text-slate-500">
              未入力（
              <Link href={`/companies/${companyId}`} className={linkClass}>
                会社詳細
              </Link>
              の担当者メールアドレス）
            </span>
          )}
        </dd>

        {sentAtLabel ? (
          <>
            <dt className="text-sm font-medium text-slate-500">送付日時</dt>
            <dd className="text-sm text-slate-900">{sentAtLabel}</dd>
          </>
        ) : null}

        {documentId === null ? null : (
          <>
            <dt className="text-sm font-medium text-slate-500">freeeサインの文書ID</dt>
            <dd className="font-mono text-sm text-slate-900">{documentId}</dd>
          </>
        )}
      </dl>

      {canSend ? (
        unavailable ? (
          <p className="rounded-md bg-slate-100 p-3 text-xs text-slate-700">{unavailable}</p>
        ) : (
          <div>
            <ConfirmDialog
              action={formAction}
              triggerLabel="契約書を送付する"
              title="契約書を送付しますか"
              description={
                contactEmail ? (
                  <>
                    <span className="font-medium">{contactEmail}</span> へ署名依頼を送ります。
                  </>
                ) : (
                  <>送付先の担当者メールアドレスが未入力です。</>
                )
              }
              consequences={[
                "署名依頼メールは freeeサインから届きます。",
                "クライアントは本システムにログインせず、メールから署名します。",
                "申請案件のステータスは変わりません。送付後に手動で「契約書送付済」へ進めてください。",
              ]}
              confirmLabel="送付する"
            >
              <ErrorList errors={state.errors} />
            </ConfirmDialog>
          </div>
        )
      ) : null}

      {/* 実装していないものを書いておく。無言だと壊れていると読まれる */}
      <p className="text-xs text-slate-600">
        再送・送付取消・締結の自動検知・締結済みPDFの取得は未実装です。
      </p>
    </div>
  )
}
