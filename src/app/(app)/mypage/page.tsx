import Link from "next/link"
import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { companies } from "@/db/schema"
import { SubmitButton } from "@/components/form"
import { buttonSecondary, FormSection, PageHeader } from "@/components/ui"
import { logoutAction } from "@/lib/auth/actions"
import { requireActiveUser } from "@/lib/auth/guards"
import { ROLE_LABELS } from "@/lib/roles"

/**
 * A-05 マイページ。
 * 自分のアカウントの確認と、パスワード・ログインIDの変更、ログアウトの入口をまとめる。
 */
export default async function MyPage() {
  const user = await requireActiveUser()

  const [company] = user.companyId
    ? await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1)
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader screenId="A-05" title="マイページ" />

      <FormSection title="アカウント情報">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-slate-600">利用者名</dt>
          <dd className="font-medium text-slate-900">{user.displayName}</dd>

          <dt className="text-slate-600">ログインID</dt>
          <dd className="font-mono text-slate-900">{user.loginId}</dd>

          <dt className="text-slate-600">権限</dt>
          <dd className="text-slate-900">
            {user.roles.map((role) => ROLE_LABELS[role]).join("・") || "権限なし"}
          </dd>

          {company ? (
            <>
              <dt className="text-slate-600">所属会社</dt>
              <dd className="text-slate-900">{company.name}</dd>
            </>
          ) : null}
        </dl>
        <p className="text-xs leading-relaxed text-slate-600">
          利用者名と権限は変更できません。変更が必要な場合は事務員またはシステム管理者へ連絡してください。
        </p>
      </FormSection>

      <FormSection
        title="ログイン情報の変更"
        description="変更するとログアウトします。新しい情報で再度ログインしてください。"
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/password/change" className={buttonSecondary}>
            パスワードを変更
          </Link>
          <Link href="/login-id" className={buttonSecondary}>
            ログインIDを変更
          </Link>
        </div>
      </FormSection>

      <FormSection
        title="ログアウト"
        description="この端末だけログアウトします。他の端末のログイン状態は変わりません。"
      >
        <form action={logoutAction}>
          <SubmitButton variant="secondary" fullWidth={false}>
            ログアウト
          </SubmitButton>
        </form>
      </FormSection>
    </div>
  )
}
