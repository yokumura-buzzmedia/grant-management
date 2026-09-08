import { AccountEditForm } from "@/components/account-edit-form"
import { AccountPasswordReset } from "@/components/account-password-reset"
import { AccountStatusControl } from "@/components/account-status-control"
import { ClientAccountForm } from "@/components/client-account-form"
import { DeleteDialog } from "@/components/delete-dialog"
import { FormDialog } from "@/components/form-dialog"
import { Th } from "@/components/ui"
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
 * 一覧は他の画面（G-01 / D-01）と同じテーブルにそろえる。操作はモーダルで開く。
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">クライアントアカウント</h2>
          <p className="mt-1 text-sm text-slate-600">
            この会社の担当者がログインするためのアカウントです。所属会社は作成後に変更できません。
          </p>
        </div>
        {/* 仮パスワードはこの中で一度だけ出す。自動で閉じると読む前に消えるので closeToken は渡さない */}
        <FormDialog
          triggerLabel="新規作成"
          triggerDescription="クライアントアカウント"
          title="クライアントアカウントを作成"
        >
          <ClientAccountForm companyId={companyId} companyName={companyName} framed={false} />
        </FormDialog>
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          この会社のクライアントアカウントはまだありません。右上の「新規作成」から追加します。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">
              この会社のクライアントアカウントの一覧。全 {accounts.length} 件。
            </caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <Th>利用者名</Th>
                <Th>ログインID</Th>
                <Th>有効／無効</Th>
                <Th>パスワード</Th>
                {/* 中身は鉛筆だけなので、見出しは読み上げにだけ渡す */}
                <Th className="w-px">
                  <span className="sr-only">操作</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-900">
                    {account.displayName}
                  </th>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{account.loginId}</td>
                  <td className="px-4 py-2.5">
                    {account.isActive ? (
                      <span className="text-slate-600">有効</span>
                    ) : (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">無効</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {/* 仮パスワードのままの人は事務員が伝え忘れている可能性がある。一覧で見つかるようにする */}
                    {account.isTemporaryPassword ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                        仮パスワード
                      </span>
                    ) : (
                      <span className="text-slate-600">本人が設定済み</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {/*
                      仮パスワードの再生成の結果はこの中に出る。自動で閉じると読む前に消えるので
                      closeToken は渡さない。閉じるのは利用者の操作に任せる。
                    */}
                    <FormDialog
                      triggerVariant="icon"
                      triggerLabel={`${account.displayName} を編集`}
                      title={`${account.displayName} の編集`}
                    >
                      {/* 枠の中に枠を積むと操作の数以上に重く見える。区切り線だけで分ける */}
                      <div className="flex flex-col gap-6 divide-y divide-slate-200 [&>*+*]:pt-6">
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

                        <AccountStatusControl
                          accountId={account.id}
                          accountName={account.displayName}
                          isActive={account.isActive}
                          // クライアントは管理者になれないため、最後の管理者や自分自身の制限にはかからない
                          disabledReason={null}
                          returnCompanyId={companyId}
                          framed={false}
                        />

                        <AccountPasswordReset
                          accountId={account.id}
                          accountName={account.displayName}
                          isTemporaryPassword={account.isTemporaryPassword}
                          framed={false}
                        />

                        <div className="flex flex-col gap-3">
                          <h3 className="text-sm font-bold text-red-700">アカウントの削除</h3>
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
                    </FormDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
