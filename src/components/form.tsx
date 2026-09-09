"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { controlClass, focusRing } from "./ui"

/**
 * 送信に失敗したときの案内。
 *
 * 検証エラーではフォームを作り直す（key を変える）ため、そのままだとフォーカスが body へ戻り、
 * キーボード操作の利用者はエラーの場所を探すことになる。作り直しのたびに
 * フォーム全体のエラーがあればその一覧へ、項目別エラーだけなら最初の該当項目へフォーカスを移す。
 */
export function ErrorList({ errors }: { errors: string[] }) {
  const anchor = useRef<HTMLDivElement>(null)
  const hasErrors = errors.length > 0

  useEffect(() => {
    const box = anchor.current
    if (!box) return
    if (hasErrors) {
      box.focus()
      return
    }
    const firstInvalid = box.closest("form")?.querySelector<HTMLElement>('[aria-invalid="true"]')
    firstInvalid?.focus()
  }, [hasErrors])

  return (
    <div
      ref={anchor}
      role={hasErrors ? "alert" : undefined}
      tabIndex={hasErrors ? -1 : undefined}
      className={
        hasErrors
          ? "rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 " + focusRing
          : "hidden"
      }
    >
      <ul>
        {errors.map((error) => (
          <li key={error} className="list-inside list-disc">
            {error}
          </li>
        ))}
      </ul>
    </div>
  )
}

const inputClass = controlClass + " w-full"

/**
 * 項目のラベル。
 * 注記とエラーは aria-describedby で入力欄に紐づける。紐づけないと、
 * 読み上げ時に「何が悪いのか」が入力欄と結び付かない。
 */
function Label({
  label,
  required,
  hint,
  errors,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  errors?: string[]
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const invalid = Boolean(errors && errors.length > 0)
  const errorId = invalid ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {/* title 属性はキーボードでも読み上げでも当てにできないので、印と語を分けて出す */}
        {required ? (
          <span className="ml-1 text-red-600">
            <span aria-hidden>*</span>
            <span className="sr-only">必須</span>
          </span>
        ) : null}
      </label>
      {children({ id, describedBy, invalid })}
      {hint ? (
        <span id={hintId} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
      {invalid ? (
        <span id={errorId} className="mt-1 block text-xs text-red-700">
          {errors?.join(" ")}
        </span>
      ) : null}
    </div>
  )
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  defaultValue,
  required,
  errors,
  inputMode,
  placeholder,
  value,
  onChange,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  hint?: string
  defaultValue?: string | number | null
  required?: boolean
  errors?: string[]
  inputMode?: "text" | "numeric" | "tel" | "email"
  placeholder?: string
  /** value と onChange を渡すと制御コンポーネントになる（郵便番号からの住所補完で使う） */
  value?: string
  onChange?: (value: string) => void
}) {
  const controlled = value !== undefined
  return (
    <Label label={label} required={required} hint={hint} errors={errors}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          // ブラウザ側の検証は使わない（表示条件はサーバー側の検証に合わせる）ため、
          // required ではなく aria-required で必須であることだけを伝える
          aria-required={required || undefined}
          {...(controlled
            ? { value, onChange: (event) => onChange?.(event.target.value) }
            : { defaultValue: defaultValue ?? "" })}
          className={invalid ? inputClass + " border-red-400" : inputClass}
        />
      )}
    </Label>
  )
}

/**
 * 複数行の入力欄。
 * カリキュラムの「目的」のように、改行を含んだまま保存する項目で使う。
 */
export function TextAreaField({
  label,
  name,
  hint,
  defaultValue,
  required,
  errors,
  rows = 6,
}: {
  label: string
  name: string
  hint?: string
  defaultValue?: string | null
  required?: boolean
  errors?: string[]
  rows?: number
}) {
  return (
    <Label label={label} required={required} hint={hint} errors={errors}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          name={name}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          defaultValue={defaultValue ?? ""}
          className={invalid ? inputClass + " border-red-400" : inputClass}
        />
      )}
    </Label>
  )
}

/**
 * 変更できない項目。
 *
 * input に readOnly を付けると、押せば直せそうに見えるうえ、なぜ直せないのかが伝わらない。
 * 値は文字として出し、変更できない理由は注記に書く。
 */
export function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700">
        {value}
      </p>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </div>
  )
}

/**
 * パスワード入力欄。表示切替を持つ。
 *
 * 仮パスワードは管理者が口頭や LINE で伝える運用のため、打ち間違いなのか
 * 伝達ミスなのかを利用者自身が切り分けられないと、問い合わせが管理者に戻ってくる。
 */
export function PasswordField({
  label,
  name,
  autoComplete,
  hint,
  required,
  errors,
}: {
  label: string
  name: string
  autoComplete?: string
  hint?: string
  required?: boolean
  errors?: string[]
}) {
  const [visible, setVisible] = useState(false)

  return (
    <Label label={label} required={required} hint={hint} errors={errors}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            name={name}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            className={(invalid ? inputClass + " border-red-400" : inputClass) + " pr-16"}
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-pressed={visible}
            className={
              "absolute inset-y-1 right-1 rounded px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
              focusRing
            }
          >
            {/* 見えている語と読み上げの語が二重にならないよう、名前は sr-only 側に一本化する */}
            <span aria-hidden>{visible ? "隠す" : "表示"}</span>
            <span className="sr-only">パスワードを{visible ? "隠す" : "表示する"}</span>
          </button>
        </div>
      )}
    </Label>
  )
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
  errors,
  placeholder = "選択してください",
}: {
  label: string
  name: string
  options: readonly { value: string; label: string }[]
  defaultValue?: string | null
  required?: boolean
  errors?: string[]
  placeholder?: string
}) {
  return (
    <Label label={label} required={required} errors={errors}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={invalid ? inputClass + " border-red-400" : inputClass}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Label>
  )
}

export function CheckboxGroup({
  label,
  name,
  options,
  defaultValues,
  required,
  errors,
  onChange,
}: {
  label: string
  name: string
  options: readonly { value: string; label: string }[]
  defaultValues?: readonly string[]
  required?: boolean
  errors?: string[]
  /** 選択が変わるたびに、選ばれている値の一覧を渡す */
  onChange?: (values: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([...(defaultValues ?? [])])

  const toggle = (value: string, checked: boolean) => {
    const next = checked ? [...selected, value] : selected.filter((v) => v !== value)
    setSelected(next)
    onChange?.(next)
  }

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="ml-1 text-red-600">
            <span aria-hidden>*</span>
            <span className="sr-only">必須</span>
          </span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)}
              className={"h-4 w-4 rounded border-slate-400 " + focusRing}
            />
            {option.label}
          </label>
        ))}
      </div>
      {errors?.map((error) => (
        <span key={error} className="mt-1 block text-xs text-red-700">
          {error}
        </span>
      ))}
    </fieldset>
  )
}

/**
 * 送信ボタンの強さ。
 * 1画面に primary が複数あると、どれが主たる操作か分からなくなる。
 * その画面の目的そのものでない送信（状態の切り替えなど）は secondary にする。
 */
const SUBMIT_VARIANTS = {
  primary: "bg-slate-900 px-5 py-2.5 text-base text-white hover:bg-slate-700",
  secondary:
    "border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50",
  danger: "bg-red-700 px-5 py-2.5 text-base text-white hover:bg-red-800",
} as const

export function SubmitButton({
  children,
  fullWidth = true,
  variant = "primary",
}: {
  children: React.ReactNode
  /** 縦積みのフォームでは全幅。横に並べるときは false */
  fullWidth?: boolean
  /** danger は確認ダイアログの中だけ。secondary は主たる操作ではない送信 */
  variant?: keyof typeof SUBMIT_VARIANTS
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        (fullWidth ? "w-full " : "") +
        "inline-flex items-center justify-center rounded-md font-medium disabled:opacity-50 " +
        SUBMIT_VARIANTS[variant] +
        " " +
        focusRing
      }
    >
      {pending ? "処理中…" : children}
    </button>
  )
}
