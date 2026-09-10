import { asc, eq, inArray } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, userRoles, users } from "@/db/schema"
import { ProjectForm } from "@/components/project-form"
import { BackLink, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"

/**
 * C-09 申請案件の作成（01_要件定義.md 5.15）。作成できるのは事務員とシステム管理者。
 * 会社詳細から来たときは company で会社を初期選択する。
 */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  await requireRoles(["staff", "admin"])
  const { company } = await searchParams

  const [companyRows, staffRows] = await Promise.all([
    db.select({ id: companies.id, name: companies.name }).from(companies).orderBy(asc(companies.name)),
    // 主担当は事務員かシステム管理者（5.16）。両方を持つ利用者が重複しないよう distinct
    db
      .selectDistinct({ id: users.id, displayName: users.displayName })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(inArray(userRoles.role, ["staff", "admin"]))
      .orderBy(asc(users.displayName)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href="/projects">申請案件一覧</BackLink>
        <PageHeader title="申請案件の作成" />
      </div>

      <ProjectForm
        companies={companyRows.map((row) => ({ value: String(row.id), label: row.name }))}
        defaultCompanyId={
          // 存在しない会社IDを渡されても、選択なしに落とす
          companyRows.some((row) => String(row.id) === company) ? company : undefined
        }
        staff={staffRows.map((row) => ({ value: String(row.id), label: row.displayName }))}
      />
    </div>
  )
}
