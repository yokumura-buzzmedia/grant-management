import { CompanyForm } from "@/components/company-form"
import { BackLink, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"
import { createCompanyAction } from "@/lib/companies/actions"

/** D-02 会社情報の登録。事務員またはシステム管理者が会社名だけを入力して作成する（5.3）。 */
export default async function NewCompanyPage() {
  await requireRoles(["staff", "admin"])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/companies">会社一覧</BackLink>
        <PageHeader screenId="D-02" title="会社の登録" />
      </div>
      <CompanyForm action={createCompanyAction} submitLabel="登録する" />
    </div>
  )
}
