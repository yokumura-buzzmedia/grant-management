/** 未実装の画面。認証とアクター別の初期表示が動いていることを確認するために置く。 */
export function Placeholder({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">
        <span className="mr-2 rounded bg-slate-200 px-2 py-0.5 font-mono text-sm">{id}</span>
        {title}
      </h1>
      <p className="text-sm text-slate-600">{note}</p>
      <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        この画面は未実装です。認証とアクター別の初期表示（5.14）の確認用に配置しています。
      </p>
    </div>
  )
}
