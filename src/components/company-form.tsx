"use client"

import { useActionState, useRef, useState, useTransition } from "react"
import { ErrorList, Field, SelectField, SubmitButton } from "@/components/form"
import { FieldRow, FormSection } from "@/components/ui"
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard"
import { EMPTY_STATE, type FormState } from "@/lib/auth/form-state"
import { COMPANY_TYPE_OPTIONS } from "@/lib/companies/schema"
import { lookupPostalCodeAction } from "@/lib/postal-codes/actions"

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
  // 検証エラーで戻ってきたときは送信値を初期値にする
  const initial = (name: keyof CompanyValues) =>
    state.values ? ((state.values[name] as string | undefined) ?? "") : values?.[name]

  // 郵便番号を入力したら住所を自動入力する（5.3）。
  // 自動入力後も利用者が住所を直せるよう、住所は制御コンポーネントにして書き換えるだけにする。
  const [postalCode, setPostalCode] = useState(values?.postalCode ?? "")
  const [address, setAddress] = useState(values?.address ?? "")
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [isLookingUp, startLookup] = useTransition()
  const lastLookedUp = useRef<string | null>(null)

  const handlePostalCode = (input: string) => {
    // 全角数字を半角へ倒し、数字以外は受け付けない（5.3）
    const digits = input
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/\D/g, "")
      .slice(0, 7)

    setPostalCode(digits)
    if (digits.length !== 7) {
      setLookupMessage(null)
      lastLookedUp.current = null
      return
    }
    if (lastLookedUp.current === digits) return
    lastLookedUp.current = digits

    startLookup(async () => {
      const result = await lookupPostalCodeAction(digits)
      if (result.status === "notFound") {
        setLookupMessage("該当する住所が見つかりませんでした。住所を手入力してください。")
        return
      }
      setAddress(result.address)
      setLookupMessage(
        result.status === "ambiguous"
          ? "この郵便番号には町域が複数あります。市区町村までを入力しました。続きを入力してください。"
          : null,
      )
    })
  }

  return (
    // ブラウザ標準の検証は無効にする。検証はサーバー側の zod に一本化し、
    // 日本語のメッセージを項目ごとにまとめて表示する。
    <form key={state.attempt ?? 0} action={formAction} noValidate className="flex flex-col gap-6">
      <UnsavedChangesGuard />
      <ErrorList errors={state.errors} />

      <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
        会社名以外は未入力のまま保存できます。すべて入力されるまで、申請案件のステータスを
        「契約書送付済」へ進められません。
      </p>

      <FormSection title="基本情報">
        <Field label="会社名" name="name" required defaultValue={initial("name")} errors={e("name")} />
        <FieldRow>
          <Field
            label="法人番号"
            name="corporateNumber"
            inputMode="numeric"
            hint="ハイフンなしの半角数字13桁"
            defaultValue={initial("corporateNumber")}
            errors={e("corporateNumber")}
          />
          <Field
            label="代表者名"
            name="representativeName"
            defaultValue={initial("representativeName")}
            errors={e("representativeName")}
          />
        </FieldRow>
        <FieldRow>
          <Field
            label="業種"
            name="industry"
            hint="自由入力"
            defaultValue={initial("industry")}
            errors={e("industry")}
          />
          <SelectField
            label="会社形態"
            name="companyType"
            options={COMPANY_TYPE_OPTIONS}
            defaultValue={initial("companyType") as string | null}
            errors={e("companyType")}
          />
        </FieldRow>
        <FieldRow>
          <Field
            label="従業員数"
            name="employeeCount"
            inputMode="numeric"
            defaultValue={initial("employeeCount")}
            errors={e("employeeCount")}
          />
          <Field
            label="資本金"
            name="capital"
            inputMode="numeric"
            hint="円"
            defaultValue={initial("capital")}
            errors={e("capital")}
          />
        </FieldRow>
      </FormSection>

      <FormSection title="所在地・連絡先">
        <FieldRow>
          <Field
            label="郵便番号"
            name="postalCode"
            inputMode="numeric"
            hint="ハイフンなしの半角数字7桁。7桁を入力すると住所を自動入力します"
            value={postalCode}
            onChange={handlePostalCode}
            errors={e("postalCode")}
          />
          <Field
            label="電話番号"
            name="phone"
            inputMode="tel"
            hint="数字10桁または11桁。ハイフンは任意"
            defaultValue={initial("phone")}
            errors={e("phone")}
          />
        </FieldRow>

        {/* 自動入力の結果は視覚以外にも伝える */}
        <div aria-live="polite" className="empty:hidden">
          {isLookingUp ? <p className="text-xs text-slate-500">住所を検索しています…</p> : null}
          {lookupMessage ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              {lookupMessage}
            </p>
          ) : null}
        </div>

        <Field
          label="住所"
          name="address"
          value={address}
          onChange={setAddress}
          errors={e("address")}
        />
        <Field
          label="建物名"
          name="buildingName"
          defaultValue={initial("buildingName")}
          errors={e("buildingName")}
        />
      </FormSection>

      <FormSection
        title="会社の主担当者"
        description="ログインアカウントとは別に管理します。契約書・見積もり兼発注書・請求書の送付先です。"
      >
        <FieldRow>
          <Field
            label="担当者名"
            name="contactName"
            defaultValue={initial("contactName")}
            errors={e("contactName")}
          />
          <Field
            label="担当者メールアドレス"
            name="contactEmail"
            type="email"
            inputMode="email"
            defaultValue={initial("contactEmail")}
            errors={e("contactEmail")}
          />
        </FieldRow>
      </FormSection>

      <div>
        <SubmitButton fullWidth={false}>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
