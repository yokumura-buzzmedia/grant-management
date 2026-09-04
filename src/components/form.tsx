"use client"

import { useFormStatus } from "react-dom"

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <ul className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      {errors.map((error) => (
        <li key={error} className="list-inside list-disc">
          {error}
        </li>
      ))}
    </ul>
  )
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"

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
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {errors?.map((error) => (
        <span key={error} className="mt-1 block text-xs text-red-700">
          {error}
        </span>
      ))}
    </label>
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
}) {
  return (
    <Label label={label} required={required} hint={hint} errors={errors}>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      />
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
      <select name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Label>
  )
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white disabled:opacity-50"
    >
      {pending ? "処理中…" : children}
    </button>
  )
}
