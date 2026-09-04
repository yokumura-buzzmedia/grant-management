import Link from "next/link"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import { CompanyForm } from "@/components/company-form"
import { requireRoles } from "@/lib/auth/guards"
import { updateCompanyAction } from "@/lib/companies/actions"
import { formatJst } from "@/lib/datetime"

const NOTICES: Record<string, string> = {
  created: "会社を登録しました。",
  saved: "会社情報を保存しました。",
}

/** D-02 会社情報の編集（5.3）。 */
export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  await requireRoles(["staff", "admin"])

  const { id } = await params
  const companyId = Number(id)
  if (!Number.isInteger(companyId) || companyId <= 0) notFound()

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company) notFound()

  const { notice } = await searchParams
  const message = notice ? NOTICES[notice] : undefined

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/companies" className="text-sm text-slate-600 underline">
          ← 会社一覧
        </Link>
        <h1 className="mt-2 text-xl font-bold">
          <span className="mr-2 rounded bg-slate-200 px-2 py-0.5 font-mono text-sm">D-02</span>
          {company.name}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          最終更新 {formatJst(company.updatedAt)}
        </p>
      </div>

      {message ? (
        <p className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900">
          {message}
        </p>
      ) : null}

      <CompanyForm
        action={updateCompanyAction.bind(null, companyId)}
        values={company}
        submitLabel="保存する"
      />
    </div>
  )
}
