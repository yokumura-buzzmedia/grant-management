import { ConfirmDialog } from "@/components/confirm-dialog"
import { SubmitButton } from "@/components/form"
import { Notice, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"
import { formatJst } from "@/lib/datetime"
import { connectionStatus, freeeSignMode, missingSettings } from "@/lib/freee-sign"
import { disconnectAction, startAuthorizationAction } from "@/lib/freee-sign/actions"

/**
 * freeeサインとの接続（05_外部連携仕様.md 3.2）。
 *
 * freeeサインが発行できるのは OAuth 2.0 クライアントだけで、サーバー間だけで
 * 完結する付与方式が無い。**管理者が一度ブラウザで認可する必要がある**ため、
 * その入口としてこの画面を置く。以後はリフレッシュトークンで自動更新するので、
 * 通常は二度と使わない。
 *
 * 接続はテナント全体の契約書を扱える権限を預ける操作なので、
 * 案件を扱う事務員ではなくシステム管理者だけに見せる。
 */

const NOTICES: Record<string, string> = {
  connected: "freeeサインと接続しました。",
  disconnected: "freeeサインとの接続を解除しました。",
}

const ERRORS: Record<string, string> = {
  notLive: "この環境は freeeサイン連携が live ではありません。",
  missingSettings: "freeeサインの設定が足りません。",
  noState: "接続の手続きが確認できませんでした。この画面から始め直してください。",
  stateMismatch: "接続の手続きが一致しませんでした。もう一度お試しください。",
  noCode: "freeeサインから認可コードが返りませんでした。もう一度お試しください。",
  exchangeFailed:
    "freeeサインとのトークン交換に失敗しました。リダイレクトURIの登録内容を確認してください。",
}

export default async function FreeeSignSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRoles(["admin"])

  const query = await searchParams
  const raw = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined)
  const notice = raw("notice")
  const error = raw("error")

  const mode = freeeSignMode()
  const missing = missingSettings()
  // 未設定の環境では接続情報を見に行かない
  const connection = mode === "live" ? await connectionStatus() : null
  const canConnect = mode === "live" && missing.length === 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="freeeサイン連携"
        description="契約書の送付に使う外部サービスとの接続です。"
      />

      {notice && NOTICES[notice] ? <Notice>{NOTICES[notice]}</Notice> : null}
      {error && ERRORS[error] ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {ERRORS[error]}
        </p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">接続状態</h2>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm font-medium text-slate-500">この環境のモード</dt>
          <dd className="text-sm text-slate-900">
            {mode === "live" ? "live（実際に送付します）" : null}
            {mode === "mock" ? "mock（freeeサインを呼びません）" : null}
            {mode === "unconfigured" ? "未設定（連携を使えません）" : null}
          </dd>

          <dt className="text-sm font-medium text-slate-500">接続</dt>
          <dd className="text-sm text-slate-900">
            {connection ? "接続済み" : <span className="text-slate-500">未接続</span>}
          </dd>

          {connection ? (
            <>
              <dt className="text-sm font-medium text-slate-500">認可した利用者</dt>
              <dd className="text-sm text-slate-900">{connection.authorizedByName}</dd>
              <dt className="text-sm font-medium text-slate-500">認可した日時</dt>
              <dd className="text-sm text-slate-900">{formatJst(connection.authorizedAt)}</dd>
              <dt className="text-sm font-medium text-slate-500">最後の更新</dt>
              <dd className="text-sm text-slate-900">{formatJst(connection.updatedAt)}</dd>
            </>
          ) : null}
        </dl>

        {mode !== "live" ? (
          <p className="rounded-md bg-slate-100 p-3 text-xs text-slate-700">
            この環境では接続の操作を行いません。ローカルは mock で動かします。
          </p>
        ) : missing.length > 0 ? (
          <p className="rounded-md bg-slate-100 p-3 text-xs text-slate-700">
            次の設定が足りません（{missing.join(", ")}）。
          </p>
        ) : null}

        {canConnect ? (
          <div className="flex flex-wrap items-start gap-3">
            <form action={startAuthorizationAction}>
              <SubmitButton fullWidth={false} variant={connection ? "secondary" : "primary"}>
                {connection ? "接続し直す" : "freeeサインと接続する"}
              </SubmitButton>
            </form>

            {connection ? (
              <ConfirmDialog
                action={disconnectAction}
                triggerLabel="接続を解除"
                triggerVariant="danger"
                title="freeeサインとの接続を解除しますか"
                description="保管しているトークンを削除します。"
                consequences={[
                  "契約書の送付ができなくなります。",
                  "送付済みの契約書と freeeサイン側の文書はそのまま残ります。",
                  "接続し直すには、もう一度ブラウザでの認可が必要です。",
                ]}
                confirmLabel="解除する"
                confirmVariant="danger"
              />
            ) : null}
          </div>
        ) : null}

        {/* 何が起きるのかを押す前に伝える。外部サービスの認可画面へ飛ぶため */}
        {canConnect && !connection ? (
          <p className="text-xs text-slate-600">
            押すと freeeサインの認可画面へ移動します。許可すると本システムへ戻り、
            以後は自動でトークンを更新するため、この操作は通常1回だけです。
          </p>
        ) : null}
      </section>
    </div>
  )
}
