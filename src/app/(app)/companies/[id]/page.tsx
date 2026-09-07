import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, projects, trainees, userRoles, users } from "@/db/schema"
import { CompanyForm } from "@/components/company-form"
import { requireRoles } from "@/lib/auth/guards"
import { updateCompanyAction } from "@/lib/companies/actions"
import { deleteCompanyAction } from "@/lib/deletions/actions"
import { DeleteDialog } from "@/components/delete-dialog"
import { Tabs } from "@/components/tabs"
import { buttonPrimary, FormSection, linkClass, Notice, PageHeader } from "@/components/ui"
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
  searchParams: Promise<{ notice?: string; tab?: string }>
}) {
  await requireRoles(["staff", "admin"])

  const { id } = await params
  const companyId = Number(id)
  if (!Number.isInteger(companyId) || companyId <= 0) notFound()

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company) notFound()

  const { notice, tab } = await searchParams
  const message = notice ? NOTICES[notice] : undefined

  // この会社に所属するクライアントアカウント（5.3）。1社に複数登録できる
  const clientAccounts = await db
    .select({
      id: users.id,
      loginId: users.loginId,
      displayName: users.displayName,
      isActive: users.isActive,
    })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "client")))
    .where(eq(users.companyId, company.id))
    .orderBy(asc(users.displayName))

  // 削除で一緒に消えるものの件数（5.3）
  const [[traineeCount], [projectCount]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(trainees).where(eq(trainees.companyId, company.id)),
    db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.companyId, company.id)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/companies" className={linkClass + " self-start text-sm"}>
          ← 会社一覧
        </Link>
        <PageHeader
          screenId="D-02"
          title={company.name}
          description={`最終更新 ${formatJst(company.updatedAt)}`}
        />
      </div>

      {message ? <Notice>{message}</Notice> : null}

      <Tabs
        label="会社情報"
        defaultTabId={tab}
        tabs={[
          {
            id: "basic",
            label: "基本情報",
            panel: (
              <>
                <CompanyForm
                  action={updateCompanyAction.bind(null, companyId)}
                  values={company}
                  submitLabel="保存する"
                />

                <section className="flex flex-col gap-4 rounded-lg border border-red-200 bg-white p-6">
                  <div>
                    <h2 className="text-base font-semibold text-red-700">会社の削除</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      会社を削除すると、紐づく申請案件・案件専用データ・クライアントアカウント・
                      受講者もすべて完全削除されます。削除履歴には会社名と法人番号が残ります。
                    </p>
                  </div>
                  <div>
                    <DeleteDialog
                      action={deleteCompanyAction.bind(null, company.id)}
                      title="会社を完全に削除しますか"
                      targetName={company.name}
                      consequences={[
                        `クライアントアカウント ${clientAccounts.length} 件が削除されます。`,
                        `受講者 ${Number(traineeCount?.count ?? 0)} 件が削除されます。`,
                        `申請案件 ${Number(projectCount?.count ?? 0)} 件と、その案件専用データが削除されます。`,
                        "削除履歴に会社名と法人番号が残ります。",
                      ]}
                    />
                  </div>
                </section>
              </>
            ),
          },
          {
            id: "accounts",
            label: "アカウント",
            count: clientAccounts.length,
            panel: (
              <FormSection
                title="クライアントアカウント"
                description="この会社の担当者がログインするためのアカウントです。所属会社は作成後に変更できません。"
              >
                {clientAccounts.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    この会社のクライアントアカウントはまだありません。
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {clientAccounts.map((account) => (
                      <li
                        key={account.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                      >
                        <Link
                          href={`/accounts/${account.id}`}
                          className={"rounded-sm font-medium text-slate-900 hover:underline " + linkClass}
                        >
                          {account.displayName}
                        </Link>
                        <span className="font-mono text-slate-600">{account.loginId}</span>
                        <span
                          className={
                            "ml-auto rounded px-2 py-0.5 text-xs " +
                            (account.isActive
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-slate-200 text-slate-700")
                          }
                        >
                          {account.isActive ? "有効" : "無効"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div>
                  <Link href={`/companies/${company.id}/accounts/new`} className={buttonPrimary}>
                    アカウントを作成
                  </Link>
                </div>
              </FormSection>
            ),
          },
        ]}
      />
    </div>
  )
}
