import Link from "next/link"
import { AccountForm } from "@/components/account-form"
import { BackLink, linkClass, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"
import { ROLE_LABELS, creatableRoles } from "@/lib/roles"

export default async function NewAccountPage() {
  const actor = await requireRoles(["staff", "admin"])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/accounts">アカウント一覧</BackLink>
        <PageHeader title="アカウントの作成" />
      </div>

      <AccountForm
        roleOptions={creatableRoles(actor.roles).map((role) => ({
          value: role,
          label: ROLE_LABELS[role],
        }))}
      />

      <div className="flex flex-col gap-1 text-xs leading-relaxed text-slate-600">
        <p>
          <Link href="/companies" className={linkClass}>
            クライアントアカウントは会社詳細から作成します
          </Link>
          。所属会社が1社に決まるためです。
        </p>
        <p>代理店アカウントは代理店マスタに紐づける必要があるため、まだ作成できません。</p>
      </div>
    </div>
  )
}
