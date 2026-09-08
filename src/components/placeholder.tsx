import { PageHeader } from "@/components/ui"

/** 未実装の画面。認証とアクター別の初期表示が動いていることを確認するために置く。 */
export function Placeholder({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader screenId={id} title={title} description={note} />
      <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        この画面は未実装です。認証とアクター別の初期表示の確認用に配置しています。
      </p>
    </div>
  )
}
