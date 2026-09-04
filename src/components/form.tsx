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

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
      />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
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
