import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import { ClientAccountForm } from "@/components/client-account-form"
import { BackLink, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"

/** 会社詳細からのクライアントアカウント作成（5.3, 5.4）。 */
export default async function NewClientAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRoles(["staff", "admin"])

  const { id } = await params
  const companyId = Number(id)
  if (!Number.isInteger(companyId) || companyId <= 0) notFound()

  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
  if (!company) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={`/companies/${company.id}?tab=accounts`}>{company.name}</BackLink>
        <PageHeader title="クライアントアカウントの作成" />
      </div>
      <ClientAccountForm companyId={company.id} companyName={company.name} />
    </div>
  )
}
