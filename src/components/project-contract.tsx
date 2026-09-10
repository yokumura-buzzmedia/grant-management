"use client"

import { useActionState } from "react"
import Link from "next/link"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FilePreviewDialog } from "@/components/file-preview-dialog"
import { ErrorList, SubmitButton } from "@/components/form"
import { buttonSecondary, linkClass } from "@/components/ui"
import { EMPTY_STATE } from "@/lib/auth/form-state"
import type { FreeeSignMode } from "@/lib/freee-sign"
import {
  FREEE_SIGN_DOCUMENT_STATUS_LABELS,
  type FreeeSignDocumentStatus,
  needsAttention,
} from "@/lib/freee-sign/document-status"
import { sendContractAction, syncContractAction } from "@/lib/projects/contract"

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
  documentStatus,
  concludedAtLabel,
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
  /** freeeサインが持つ文書の状態。一度も取り直していなければ null */
  documentStatus: FreeeSignDocumentStatus | null
  /** 締結を確認できた日時（JST表記済み） */
  concludedAtLabel: string | null
  concluded: boolean
  canceled: boolean
  mode: FreeeSignMode
  /** live で足りない環境変数。連携を有効にできない理由として出す */
  missingSettings: string[]
  /** 事務員とシステム管理者だけ */
  canSend: boolean
}) {
  const [state, formAction] = useActionState(sendContractAction.bind(null, projectId), EMPTY_STATE)
  const [syncState, syncAction] = useActionState(
    async () => syncContractAction(projectId),
    EMPTY_STATE,
  )

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

        {documentStatus ? (
          <>
            <dt className="text-sm font-medium text-slate-500">freeeサイン上の状態</dt>
            <dd
              className={
                "text-sm " +
                (needsAttention(documentStatus) ? "font-bold text-red-700" : "text-slate-900")
              }
            >
              {FREEE_SIGN_DOCUMENT_STATUS_LABELS[documentStatus]}
            </dd>
          </>
        ) : null}

        {concludedAtLabel ? (
          <>
            <dt className="text-sm font-medium text-slate-500">締結を確認した日時</dt>
            <dd className="text-sm text-slate-900">{concludedAtLabel}</dd>
          </>
        ) : null}

        {documentId === null ? null : (
          <>
            <dt className="text-sm font-medium text-slate-500">freeeサインの文書ID</dt>
            <dd className="font-mono text-sm text-slate-900">{documentId}</dd>
          </>
        )}
      </dl>

      {/*
        * PDF は閲覧できる人全員に出す（06_画面設計.md の権限マトリクスで
        * クライアント・代理店も C-04 を閲覧できるため）。
        * 締結済みは保存したものを、それ以外は freeeサインから都度取り直して見せる。
        */}
      {sentAtLabel ? (
        <div className="flex flex-wrap items-center gap-3">
          <FilePreviewDialog
            url={`/projects/${projectId}/contract/pdf`}
            filename="契約書"
            contentType="application/pdf"
          />
          <a href={`/projects/${projectId}/contract/pdf?download=1`} className={buttonSecondary}>
            ダウンロード
          </a>
        </div>
      ) : null}

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
                "「助成金説明済」の案件は、送付できたら「契約書送付済」へ自動で進みます。",
              ]}
              confirmLabel="送付する"
            >
              <ErrorList errors={state.errors} />
            </ConfirmDialog>
          </div>
        )
      ) : null}

      {/* 締結の自動検知（ポーリング）は未実装。いまは事務員が取り直す（3.11） */}
      {canSend && sentAtLabel && !unavailable ? (
        <div className="flex flex-col gap-2">
          <form action={syncAction}>
            <SubmitButton fullWidth={false} variant="secondary">
              最新状態を取得
            </SubmitButton>
          </form>
          <ErrorList errors={syncState.errors} />
          <p className="text-xs text-slate-600">
            freeeサインに問い合わせて、この契約書の状態を取り直します。
            締結を確認しても申請案件のステータスは変わりません。
          </p>
        </div>
      ) : null}

      {/* 実装していないものを書いておく。無言だと壊れていると読まれる */}
      <p className="text-xs text-slate-600">
        再送・送付取消・締結の自動検知は未実装です。
      </p>
    </div>
  )
}
