"use client"

import { useActionState } from "react"
import { ErrorList, Field, SelectField, SubmitButton } from "@/components/form"
import { EMPTY_STATE, type FormState } from "@/lib/auth/form-state"
import { COMPANY_TYPE_OPTIONS } from "@/lib/companies/schema"

type CompanyValues = {
  name: string
  corporateNumber: string | null
  representativeName: string | null
  industry: string | null
  companyType: string | null
  employeeCount: number | null
  capital: number | null
  postalCode: string | null
  address: string | null
  buildingName: string | null
  phone: string | null
  contactName: string | null
  contactEmail: string | null
}

/**
 * D-02 会社情報の登録・編集（5.3）。
 * 最終的には全項目が必須だが、一時保存できるよう会社名以外は未入力のまま保存できる。
 */
export function CompanyForm({
  action,
  values,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  values?: CompanyValues
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE)
  const e = (name: keyof CompanyValues) => state.fieldErrors?.[name]

  return (
    // ブラウザ標準の検証は無効にする。検証はサーバー側の zod に一本化し、
    // 日本語のメッセージを項目ごとにまとめて表示する。
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <ErrorList errors={state.errors} />

      <p className="rounded-md bg-slate-100 p-3 text-xs leading-relaxed text-slate-600">
        会社名以外は未入力のまま保存できます。すべて入力されるまで、申請案件のステータスを
        「契約書送付済」へ進められません（5.3）。
      </p>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-bold text-slate-500">基本情報</h2>
        <Field label="会社名" name="name" required defaultValue={values?.name} errors={e("name")} />
        <Field
          label="法人番号"
          name="corporateNumber"
          inputMode="numeric"
          hint="ハイフンなしの半角数字13桁"
          defaultValue={values?.corporateNumber}
          errors={e("corporateNumber")}
        />
        <Field
          label="代表者名"
          name="representativeName"
          defaultValue={values?.representativeName}
          errors={e("representativeName")}
        />
        <Field
          label="業種"
          name="industry"
          hint="自由入力"
          defaultValue={values?.industry}
          errors={e("industry")}
        />
        <SelectField
          label="会社形態"
          name="companyType"
          options={COMPANY_TYPE_OPTIONS}
          defaultValue={values?.companyType}
          errors={e("companyType")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="従業員数"
            name="employeeCount"
            inputMode="numeric"
            defaultValue={values?.employeeCount}
            errors={e("employeeCount")}
          />
          <Field
            label="資本金"
            name="capital"
            inputMode="numeric"
            hint="円"
            defaultValue={values?.capital}
            errors={e("capital")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-bold text-slate-500">所在地・連絡先</h2>
        <Field
          label="郵便番号"
          name="postalCode"
          inputMode="numeric"
          hint="ハイフンなしの半角数字7桁。住所の自動入力は未実装です"
          defaultValue={values?.postalCode}
          errors={e("postalCode")}
        />
        <Field label="住所" name="address" defaultValue={values?.address} errors={e("address")} />
        <Field
          label="建物名"
          name="buildingName"
          defaultValue={values?.buildingName}
          errors={e("buildingName")}
        />
        <Field
          label="電話番号"
          name="phone"
          inputMode="tel"
          hint="数字10桁または11桁。ハイフンは任意"
          defaultValue={values?.phone}
          errors={e("phone")}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-bold text-slate-500">会社の主担当者</h2>
        <p className="text-xs text-slate-500">
          ログインアカウントとは別に管理します。契約書・見積もり兼発注書・請求書の送付先です。
        </p>
        <Field
          label="担当者名"
          name="contactName"
          defaultValue={values?.contactName}
          errors={e("contactName")}
        />
        <Field
          label="担当者メールアドレス"
          name="contactEmail"
          type="email"
          inputMode="email"
          defaultValue={values?.contactEmail}
          errors={e("contactEmail")}
        />
      </section>

      <div className="sm:max-w-xs">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
