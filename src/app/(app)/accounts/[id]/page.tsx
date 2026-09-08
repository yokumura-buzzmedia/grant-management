import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import { AccountEditForm } from "@/components/account-edit-form"
import { AccountPasswordReset } from "@/components/account-password-reset"
import { AccountStatusControl } from "@/components/account-status-control"
import { canManage, countActiveAdmins, findAccount } from "@/lib/accounts/authorize"
import { DeleteDialog } from "@/components/delete-dialog"
import { BackLink, Notice, PageHeader } from "@/components/ui"
import { deleteAccountAction } from "@/lib/deletions/actions"
import { requireRoles } from "@/lib/auth/guards"
import { ROLE_LABELS, creatableRoles } from "@/lib/roles"

const NOTICES: Record<string, string> = {
  saved: "アカウントを保存しました。",
  activated: "アカウントを有効にしました。",
  deactivated: "アカウントを無効にしました。ログイン中の端末はログアウトされました。",
}

const ERRORS: Record<string, string> = {
  forbidden: "このアカウントを操作する権限がありません。",
  self: "自分自身のアカウントは無効にできません。",
  lastAdmin: "有効なシステム管理者が1人だけのため、無効にできません。",
}

/** G-02 アカウントの編集（5.4）。 */
export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const actor = await requireRoles(["staff", "admin"])

  const { id } = await params
  const accountId = Number(id)
  if (!Number.isInteger(accountId) || accountId <= 0) notFound()

  const account = await findAccount(accountId)
  // 事務員にはシステム管理者のアカウントを見せない（5.4）
  if (!account || !canManage(actor.roles, account)) notFound()

  const [company] = account.companyId
    ? await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, account.companyId))
        .limit(1)
    : []

  const { notice, error } = await searchParams
  const assignable = creatableRoles(actor.roles)
  const fixedRoles = account.roles.filter((role) => !assignable.includes(role))

  // 無効にできない条件（5.4）
  const otherActiveAdmins = await countActiveAdmins(account.id)
  const disabledReason =
    account.isActive && account.id === actor.id
      ? "自分自身のアカウントは無効にできません。"
      : account.isActive && account.roles.includes("admin") && otherActiveAdmins === 0
        ? "有効なシステム管理者が1人だけのため、無効にできません。"
        : null

  // 有効なシステム管理者が1人だけの場合は削除できない（5.4）
  const deleteBlockedReason =
    account.roles.includes("admin") && account.isActive && otherActiveAdmins === 0
      ? "有効なシステム管理者が1人だけのため、削除できません。"
      : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/accounts">アカウント一覧</BackLink>
        <PageHeader
          screenId="G-02"
          title={account.displayName}
          description={[
            account.loginId,
            account.roles.map((role) => ROLE_LABELS[role]).join("・"),
            company?.name,
          ]
            .filter(Boolean)
            .join(" ／ ")}
        />
      </div>

      {notice && NOTICES[notice] ? <Notice>{NOTICES[notice]}</Notice> : null}
      {error && ERRORS[error] ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {ERRORS[error]}
        </p>
      ) : null}

      <AccountEditForm
        accountId={account.id}
        loginId={account.loginId}
        displayName={account.displayName}
        roles={account.roles.filter((role) => assignable.includes(role))}
        roleOptions={assignable.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
        fixedRoleLabels={fixedRoles.map((role) => ROLE_LABELS[role])}
      />

      <AccountStatusControl
        accountId={account.id}
        accountName={account.displayName}
        isActive={account.isActive}
        disabledReason={disabledReason}
      />

      <AccountPasswordReset
        accountId={account.id}
        accountName={account.displayName}
        isTemporaryPassword={account.isTemporaryPassword}
      />

      <section className="flex flex-col gap-4 rounded-lg border border-red-200 bg-white p-6">
        <h2 className="text-sm font-bold text-red-700">アカウントの削除</h2>
        {deleteBlockedReason ? (
          <p className="rounded-md bg-slate-100 p-3 text-xs text-slate-600">{deleteBlockedReason}</p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-slate-600">
              完全削除しても、過去の申請案件・掲示板投稿・予約に表示される利用者名は残ります。
              クライアントアカウントを削除しても、所属会社や業務データは残ります。
            </p>
            <div>
              <DeleteDialog
                action={deleteAccountAction.bind(null, account.id, null)}
                title="アカウントを完全に削除しますか"
                targetName={`${account.displayName}（${account.loginId}）`}
                consequences={[
                  "ログイン中のすべての端末がログアウトします。",
                  "削除履歴に利用者名とログインIDが残ります。",
                  ...(account.id === actor.id ? ["自分自身のアカウントです。削除するとログアウトします。"] : []),
                ]}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
