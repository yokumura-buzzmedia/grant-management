import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, projects, trainees, userRoles, users } from "@/db/schema"
import { CompanyForm } from "@/components/company-form"
import { canManageCompanies, requireCompanyEditor } from "@/lib/companies/authorize"
import { updateCompanyAction } from "@/lib/companies/actions"
import { deleteCompanyAction } from "@/lib/deletions/actions"
import { DeleteDialog } from "@/components/delete-dialog"
import { Tabs } from "@/components/tabs"
import { CompanyAccounts } from "@/components/company-accounts"
import { CompanyTrainees } from "@/components/company-trainees"
import { BackLink, Notice, PageHeader } from "@/components/ui"
import { formatJst } from "@/lib/datetime"

const NOTICES: Record<string, string> = {
  created: "会社を登録しました。",
  saved: "会社情報を保存しました。",
  // account- はクライアントアカウントの操作。会社自身の通知と文言が違うため分ける
  "account-saved": "アカウントを保存しました。",
  "account-activated": "アカウントを有効にしました。",
  "account-deactivated": "アカウントを無効にしました。ログイン中の端末はログアウトされました。",
  "account-deleted": "アカウントを削除しました。削除履歴に記録しています。",
  // trainee- は受講者の操作
  "trainee-created": "受講者を登録しました。",
  "trainee-saved": "受講者を保存しました。",
  "trainee-deleted": "受講者を削除しました。",
}

const ERRORS: Record<string, string> = {
  "account-forbidden": "このアカウントを操作する権限がありません。",
  "account-self": "自分自身のアカウントは無効にできません。",
  "account-lastAdmin": "有効なシステム管理者が1人だけのため、操作できません。",
}

/** D-02 会社情報の編集（5.3）。 */
export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string; error?: string; tab?: string }>
}) {
  const { id } = await params
  const companyId = Number(id)
  if (!Number.isInteger(companyId) || companyId <= 0) notFound()

  // クライアントは自社だけ編集できる（06_画面設計.md 5 の ○）
  const user = await requireCompanyEditor(companyId)
  const manager = canManageCompanies(user)

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company) notFound()

  const { notice, error, tab } = await searchParams
  const message = notice ? NOTICES[notice] : undefined
  const errorMessage = error ? ERRORS[error] : undefined

  // アカウント管理と削除は事務員・システム管理者だけ。
  // クライアントには出さないので、そのための問い合わせも行わない
  const clientAccounts = manager
    ? await db
        .select({
          id: users.id,
          loginId: users.loginId,
          displayName: users.displayName,
          isActive: users.isActive,
          isTemporaryPassword: users.isTemporaryPassword,
        })
        .from(users)
        .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "client")))
        .where(eq(users.companyId, company.id))
        .orderBy(asc(users.displayName))
    : []

  // 受講者はクライアントも編集できる（5.6）。アカウントと違い、権限で出し分けない
  const traineeRows = await db
    .select({
      id: trainees.id,
      name: trainees.name,
      nameKana: trainees.nameKana,
      insuranceNumber: trainees.insuranceNumber,
      employmentType: trainees.employmentType,
      jobType: trainees.jobType,
      jobDescription: trainees.jobDescription,
      gender: trainees.gender,
      updatedAt: trainees.updatedAt,
    })
    .from(trainees)
    .where(eq(trainees.companyId, company.id))
    .orderBy(asc(trainees.nameKana), asc(trainees.name))

  // 削除で一緒に消えるものの件数（5.3）。受講者は取得済みの行から数える
  const [projectCount] = manager
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.companyId, company.id))
    : [{ count: 0 }]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {/* クライアントは会社一覧（D-01）を利用できないため、戻り先を出さない */}
        {manager ? <BackLink href="/companies">会社一覧</BackLink> : null}
        <PageHeader
          title={company.name}
          description={`最終更新 ${formatJst(company.updatedAt)}`}
        />
      </div>

      {message ? <Notice>{message}</Notice> : null}
      {errorMessage ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : null}

      {/* 受講者はクライアントも編集できるため（5.6）、タブは権限によらず2枚以上ある */}
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

                {/* 会社の削除は事務員・システム管理者だけ（06_画面設計.md 5） */}
                {manager ? (
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
                          `受講者 ${traineeRows.length} 件が削除されます。`,
                          `申請案件 ${Number(projectCount?.count ?? 0)} 件と、その案件専用データが削除されます。`,
                          "削除履歴に会社名と法人番号が残ります。",
                        ]}
                      />
                    </div>
                  </section>
                ) : null}
              </>
            ),
          },
          {
            id: "trainees",
            label: "受講者",
            count: traineeRows.length,
            panel: <CompanyTrainees companyId={company.id} trainees={traineeRows} />,
          },
          ...(manager
            ? [
                {
                  id: "accounts",
                  label: "アカウント",
                  count: clientAccounts.length,
                  panel: (
                    <CompanyAccounts
                      companyId={company.id}
                      companyName={company.name}
                      accounts={clientAccounts}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  )
}
