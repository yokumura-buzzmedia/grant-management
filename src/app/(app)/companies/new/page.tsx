import Link from "next/link"
import { CompanyForm } from "@/components/company-form"
import { requireRoles } from "@/lib/auth/guards"
import { createCompanyAction } from "@/lib/companies/actions"

/** D-02 会社情報の登録。事務員またはシステム管理者が会社名だけを入力して作成する（5.3）。 */
export default async function NewCompanyPage() {
  await requireRoles(["staff", "admin"])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/companies" className="text-sm text-slate-600 underline">
          ← 会社一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">
          <span className="mr-2 rounded bg-slate-200 px-2 py-0.5 font-mono text-sm">D-02</span>
          会社の登録
        </h1>
      </div>
      <CompanyForm action={createCompanyAction} submitLabel="登録する" />
    </div>
  )
}
