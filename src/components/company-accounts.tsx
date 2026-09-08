import { AccountEditForm } from "@/components/account-edit-form"
import { AccountPasswordReset } from "@/components/account-password-reset"
import { AccountStatusControl } from "@/components/account-status-control"
import { ClientAccountForm } from "@/components/client-account-form"
import { DeleteDialog } from "@/components/delete-dialog"
import { focusRing } from "@/components/ui"
import { deleteAccountAction } from "@/lib/deletions/actions"

export type CompanyAccount = {
  id: number
  loginId: string
  displayName: string
  isActive: boolean
  /** 仮パスワードのまま。本人がまだ自分のパスワードを設定していない */
  isTemporaryPassword: boolean
}

/**
 * D-02 会社詳細のクライアントアカウント。
 *
 * この会社のアカウントは権限がクライアントに固定で、所属会社も動かないため、
 * G-02 へ移動させずにこの場で作成・編集・有効／無効・仮パスワード再生成・削除まで行う。
 * 操作の中身は G-02 と同じコンポーネントを使い、戻り先だけ会社詳細に差し替える。
 *
 * 行の開閉は details に任せる。キーボード操作と読み上げの扱いをブラウザが持つ。
 */
export function CompanyAccounts({
  companyId,
  companyName,
  accounts,
}: {
  companyId: number
  companyName: string
  accounts: CompanyAccount[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">クライアントアカウント</h2>
        <p className="mt-1 text-sm text-slate-600">
          この会社の担当者がログインするためのアカウントです。所属会社は作成後に変更できません。
        </p>
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          この会社のクライアントアカウントはまだありません。下の「アカウントを作成」から追加します。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li key={account.id} className="rounded-lg border border-slate-200 bg-white">
              <details className="group">
                <summary
                  className={
                    "flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 rounded-lg p-4 hover:bg-slate-50 " +
                    focusRing
                  }
                >
                  <span className="font-medium text-slate-900">{account.displayName}</span>
                  <span className="font-mono text-sm text-slate-600">{account.loginId}</span>
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs " +
                      (account.isActive
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-200 text-slate-700")
                    }
                  >
                    {account.isActive ? "有効" : "無効"}
                  </span>
                  {/* 仮パスワードのままの人は事務員が伝え忘れている可能性がある。一覧で見つかるようにする */}
                  {account.isTemporaryPassword ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                      仮パスワード
                    </span>
                  ) : null}
                  <span className="ml-auto text-sm text-slate-600">
                    <span className="group-open:hidden">開く</span>
                    <span className="hidden group-open:inline">閉じる</span>
                  </span>
                </summary>

                {/* 枠の中に枠を積むと操作の数以上に重く見える。区切り線だけで分ける */}
                <div className="divide-y divide-slate-200 border-t border-slate-200">
                  <div className="p-4">
                    {/* 権限はクライアント固定。roleOptions を空にして権限欄を出さない */}
                    <AccountEditForm
                      accountId={account.id}
                      loginId={account.loginId}
                      displayName={account.displayName}
                      roles={[]}
                      roleOptions={[]}
                      fixedRoleLabels={[]}
                      returnCompanyId={companyId}
                      framed={false}
                    />
                  </div>

                  <div className="p-4">
                    <AccountStatusControl
                      accountId={account.id}
                      accountName={account.displayName}
                      isActive={account.isActive}
                      // クライアントは管理者になれないため、最後の管理者や自分自身の制限にはかからない
                      disabledReason={null}
                      returnCompanyId={companyId}
                      framed={false}
                    />
                  </div>

                  <div className="p-4">
                    <AccountPasswordReset
                      accountId={account.id}
                      accountName={account.displayName}
                      isTemporaryPassword={account.isTemporaryPassword}
                      framed={false}
                    />
                  </div>

                  <div className="flex flex-col gap-3 p-4">
                    <h2 className="text-sm font-bold text-red-700">アカウントの削除</h2>
                    {/* 影響の内訳は確認ダイアログが持つ。ここで先に並べると二重になる */}
                    <div>
                      <DeleteDialog
                        action={deleteAccountAction.bind(null, account.id, companyId)}
                        title="アカウントを完全に削除しますか"
                        targetName={`${account.displayName}（${account.loginId}）`}
                        consequences={[
                          "ログイン中のすべての端末がログアウトします。",
                          "削除履歴に利用者名とログインIDが残ります。",
                          "この会社と過去の申請案件は残ります。",
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <details className="group rounded-lg border border-slate-200 bg-white">
        {/* 行の開閉と同じ見た目にする。flex にすると既定の三角マーカーも消える */}
        <summary
          className={
            "flex cursor-pointer items-center gap-4 rounded-lg p-4 text-sm font-medium text-slate-900 hover:bg-slate-50 " +
            focusRing
          }
        >
          アカウントを作成
          <span className="ml-auto font-normal text-slate-600">
            <span className="group-open:hidden">開く</span>
            <span className="hidden group-open:inline">閉じる</span>
          </span>
        </summary>
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <ClientAccountForm companyId={companyId} companyName={companyName} />
        </div>
      </details>
    </div>
  )
}
