/**
 * freeeサインの文書ステータス（05_外部連携仕様.md 3.4）。
 *
 * 自社の提出書類の状態（`enums.ts` の `DOCUMENT_STATUSES`）とは別物。
 * あちらは受講者の雇用契約書などの「提出済／承認済」で、こちらは freeeサインが持つ値。
 *
 * **DBを読み込まないファイルに分けている。** 表示名をクライアントコンポーネントから
 * 使うため、`index.ts`（`db` を import する）に置くとサーバー側のコードが
 * ブラウザ向けの束に混ざる。
 */

export const FREEE_SIGN_DOCUMENT_STATUSES = [
  "draft",
  "in_progress",
  "awaiting_receipt",
  "approved",
  "concluded",
  "rejected",
  "expired",
  "trashed",
] as const

export type FreeeSignDocumentStatus = (typeof FREEE_SIGN_DOCUMENT_STATUSES)[number]

export const isDocumentStatus = (value: unknown): value is FreeeSignDocumentStatus =>
  typeof value === "string" && (FREEE_SIGN_DOCUMENT_STATUSES as readonly string[]).includes(value)

/**
 * 画面に出す名前。freeeサインの用語をそのまま訳すのではなく、
 * 事務員が次に何をすればよいか分かる言い方にする。
 */
export const FREEE_SIGN_DOCUMENT_STATUS_LABELS: Record<FreeeSignDocumentStatus, string> = {
  draft: "作成中（未送信）",
  in_progress: "署名待ち",
  awaiting_receipt: "受け取り待ち",
  approved: "要確認",
  concluded: "締結済み",
  rejected: "却下されました",
  expired: "有効期限切れ",
  trashed: "freeeサイン側で削除されました",
}

/**
 * 事務員の対応が要る状態か。
 * 却下・期限切れ・削除は放置すると案件が止まるので、画面で目立たせる。
 * ステータスは自動で戻さない（3.9）。
 */
export const needsAttention = (status: FreeeSignDocumentStatus) =>
  status === "rejected" || status === "expired" || status === "trashed"
