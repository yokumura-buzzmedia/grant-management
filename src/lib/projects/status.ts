import { PROJECT_STATUSES, type ProjectStatus } from "@/db/schema"

/**
 * 申請案件のステータスの表示名（01_要件定義.md 5章冒頭）。
 *
 * 並び順は enums.ts の PROJECT_STATUSES がそのまま持つ。番号を添えるのは、
 * 業務側が「いま何番」で会話するため（11_ステータスの遷移.drawio と対応）。
 *
 * ステータスの構成は暫定で、各段階へ進む「条件」は要件定義の第6章で未確定。
 * ただし変更ルール（順序どおり・戻さない・飛ばさない）は5.1で確定しているため、
 * 操作そのものは確定を待たずに作れる。
 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  prospecting: "営業中",
  verbal_agreement: "内諾",
  subsidy_explained: "助成金説明済",
  contract_sent: "契約書送付済",
  contract_concluded: "契約締結済",
  company_info_entry: "必要事項記入中",
  employment_contract_pending: "雇用契約書提出中",
  employment_contract_completed: "雇用契約書提出済",
  schedule_confirmed: "日程調整済",
  curriculum_selected: "カリキュラム選定済",
  quotation_sent: "見積もり兼発注書送付済",
  quotation_received: "見積もり兼発注書受領済",
  gbiz_guided: "GBiz案内済",
  gbiz_registered: "GBiz記入済",
  invoice_sent: "請求書送付済",
  plan_submitted: "計画届済",
  payment_confirmed: "入金確認済",
  training_in_progress: "研修中",
  training_completed: "研修完了",
  subsidy_application_notified: "支給申請連絡済",
  documents_collecting: "必要書類収集中",
  documents_collected: "必要書類収集完了",
  subsidy_application_completed: "助成金の支給申請完了",
  completed: "完了",
  inquiry: "問い合わせ",
}

/** 何番目のステータスか。1起点。表示と絞り込みの並びに使う */
export const statusNumber = (status: ProjectStatus) => PROJECT_STATUSES.indexOf(status) + 1

/** 絞り込みの選択肢。番号付きで出す */
export const PROJECT_STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({
  value: status,
  label: `${statusNumber(status)}. ${PROJECT_STATUS_LABELS[status]}`,
}))

/** 文字列が申請案件のステータスか。フォームから来た値の検証に使う */
export const isProjectStatus = (value: string): value is ProjectStatus =>
  (PROJECT_STATUSES as readonly string[]).includes(value)

/**
 * 次に進めるステータス（5.1）。
 *
 * 決められた順序を1つずつ進む。前へは戻せず、途中を飛ばすこともできない。
 * 唯一の例外が「完了」と「問い合わせ」で、ここだけ双方向に変更できる。
 * 終端は無いので、必ず1つ返る。
 */
export const nextStatus = (status: ProjectStatus): ProjectStatus | null => {
  if (status === "completed") return "inquiry"
  if (status === "inquiry") return "completed"
  return PROJECT_STATUSES[PROJECT_STATUSES.indexOf(status) + 1] ?? null
}

/**
 * 業務フェーズ（06_画面設計.md B-01 / 11_ステータスの遷移.drawio）。
 *
 * 24段階を並べても現在地が掴めないため、10のフェーズにまとめて位置を示す。
 * 区切りはダッシュボードの集計単位と揃える。ここでずらすと、
 * 一覧で見たフェーズと詳細で見たフェーズが食い違う。
 *
 * lastNumber はそのフェーズに入る最後のステータスの番号。
 * 25 問い合わせ は完了からの往復なので、どのフェーズにも入れない。
 */
export const PROJECT_PHASES = [
  { name: "営業", lastNumber: 3 },
  { name: "契約", lastNumber: 5 },
  { name: "受入準備", lastNumber: 8 },
  { name: "案件準備", lastNumber: 10 },
  { name: "見積", lastNumber: 12 },
  { name: "助成金申請手続き", lastNumber: 14 },
  { name: "請求・計画届・入金", lastNumber: 17 },
  { name: "研修", lastNumber: 19 },
  { name: "支給申請", lastNumber: 23 },
  { name: "完了", lastNumber: 24 },
] as const

/**
 * そのステータスが属する業務フェーズの位置（0起点）。
 * 問い合わせは完了からの往復なので、完了と同じ位置に置く。
 */
export const phaseIndex = (status: ProjectStatus) => {
  const number = status === "inquiry" ? 24 : statusNumber(status)
  const index = PROJECT_PHASES.findIndex((phase) => number <= phase.lastNumber)
  return index === -1 ? PROJECT_PHASES.length - 1 : index
}

/**
 * ドロップダウンの選択肢。フェーズごとにまとめる。
 * 全体の流れの中で、いまどこにいて次がどこかを選択肢の並びだけで読めるようにする。
 */
export const PROJECT_STATUS_GROUPS: { name: string; statuses: ProjectStatus[] }[] = (() => {
  const groups: { name: string; statuses: ProjectStatus[] }[] = []
  let from = 0
  for (const phase of PROJECT_PHASES) {
    groups.push({ name: phase.name, statuses: PROJECT_STATUSES.slice(from, phase.lastNumber) })
    from = phase.lastNumber
  }
  // 完了からの往復は流れの外に置く（06_画面設計.md B-01）
  groups.push({ name: "完了後", statuses: ["inquiry"] })
  return groups
})()
