import Link from "next/link"
import { AccountForm } from "@/components/account-form"
import { requireRoles } from "@/lib/auth/guards"
import { ROLE_LABELS, creatableRoles } from "@/lib/roles"

export default async function NewAccountPage() {
  const actor = await requireRoles(["staff", "admin"])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/accounts" className="text-sm text-slate-600 underline">
          ← アカウント一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">
          <span className="mr-2 rounded bg-slate-200 px-2 py-0.5 font-mono text-sm">G-02</span>
          アカウントの作成
        </h1>
      </div>

      <AccountForm
        roleOptions={creatableRoles(actor.roles).map((role) => ({
          value: role,
          label: ROLE_LABELS[role],
        }))}
      />

      <div className="text-xs leading-relaxed text-slate-500">
        <p>
          <Link href="/companies" className="underline">
            クライアントアカウントは会社詳細から作成します
          </Link>
          。所属会社が1社に決まるためです。
        </p>
        <p>代理店アカウントは代理店マスタに紐づける必要があるため、まだ作成できません。</p>
      </div>
    </div>
  )
}
