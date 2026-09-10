import { and, eq, isNull, ne, or, sql } from "drizzle-orm"
import { db } from "@/db/client"
import { companies, employmentContracts, trainees, type ProjectStatus } from "@/db/schema"

/**
 * ステータスを次へ進めるための前提条件（01_要件定義.md 5.1, 5.2, 5.3）。
 *
 * 進める操作そのものは事務員が手で行うが、要件が明示している条件だけは機械的に確かめる。
 * 満たしていない理由は画面に出す（06_画面設計.md C-02）。
 *
 * ここで見るのは、要件が確定していて、かつ実装済みの機能で判定できるものだけ。
 * 次の2つは条件が確定しているが、判定に必要な機能がまだ無いため見ていない。
 *
 * - 22 必要書類収集完了 … 支給申請用の書類がすべて承認済みであること（5.2）。
 *   書類の種類と名称が未確定（要件6章1）で、C-03 も未実装
 * - 5 契約締結済 … freeeサインで締結を検知してから進める（3.9・ポーリング未実装）
 * - 9 日程調整済 / 10 カリキュラム選定済 / 12 見積もり兼発注書受領済 …
 *   予約・チーム・見積の実装後に、それぞれの完了を条件へ足す
 *
 * 残りの遷移は条件が未確定（要件6章3）なので、事務員の判断だけで進む。
 */

/** 会社情報の必須項目（5.3）。会社名は作成時に必ず入るため見ない */
const REQUIRED_COMPANY_FIELDS = [
  ["corporateNumber", "法人番号"],
  ["representativeName", "代表者名"],
  ["industry", "業種"],
  ["companyType", "会社形態"],
  ["employeeCount", "従業員数"],
  ["capital", "資本金"],
  ["postalCode", "郵便番号"],
  ["address", "住所"],
  ["buildingName", "建物名"],
  ["phone", "電話番号"],
  ["contactName", "担当者名"],
  ["contactEmail", "担当者メールアドレス"],
] as const

/**
 * 会社情報が揃っているか（5.3 / 06_画面設計.md D-02）。
 *
 * 会社情報は一時保存できるため、未入力のままでも申請案件を作れる。
 * 「6 必要事項記入中」を抜けるときに、全項目と受講者1人以上を求める。
 *
 * 契約書の送付時点ではない。05_外部連携仕様.md 3.5 が
 * 「契約書を送付する時点では会社情報がまだ入力されていません」と書いており、
 * だからこそ会社名を署名者側の入力項目に置いている。送付時点で求めると、
 * 契約書を送ったのにステータスを進められない状態になる。
 *
 * ただし 6→7 の遷移条件そのものは未確定（11_ステータスの遷移.drawio）。
 * 「会社情報の必須項目の入力完了と対応する可能性」とあるものを採っている。
 */
const checkCompanyReady = async (companyId: number) => {
  const [company] = await db
    .select({
      corporateNumber: companies.corporateNumber,
      representativeName: companies.representativeName,
      industry: companies.industry,
      companyType: companies.companyType,
      employeeCount: companies.employeeCount,
      capital: companies.capital,
      postalCode: companies.postalCode,
      address: companies.address,
      buildingName: companies.buildingName,
      phone: companies.phone,
      contactName: companies.contactName,
      contactEmail: companies.contactEmail,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
  if (!company) return ["会社情報を取得できませんでした。"]

  const blockers: string[] = []

  // 従業員数と資本金は 0 も正しい入力なので、空判定は null だけで行う
  const missing = REQUIRED_COMPANY_FIELDS.filter(([key]) => company[key] === null).map(
    ([, label]) => label,
  )
  if (missing.length > 0) {
    blockers.push(`会社情報の必須項目が未入力です（${missing.join("、")}）。`)
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainees)
    .where(eq(trainees.companyId, companyId))
  if (Number(row?.count ?? 0) === 0) {
    blockers.push("受講者が1人も登録されていません。")
  }

  return blockers
}

/**
 * 雇用契約書がすべて承認済みか（5.2）。
 *
 * 対象は会社に登録されているすべての受講者で、案件やチームへの登録有無では絞らない。
 * 承認は会社単位で一度だけ行うため、同じ会社の他の申請案件でも同じ結果になる。
 */
const checkEmploymentContracts = async (companyId: number) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainees)
    .leftJoin(employmentContracts, eq(employmentContracts.traineeId, trainees.id))
    .where(
      and(
        eq(trainees.companyId, companyId),
        or(isNull(employmentContracts.id), ne(employmentContracts.status, "approved")),
      ),
    )
  const pending = Number(row?.count ?? 0)
  return pending > 0
    ? [`雇用契約書が承認されていない受講者が ${pending} 人います。`]
    : []
}

/**
 * 指定のステータスへ進めない理由を返す。空配列なら進める。
 * 画面の表示と、サーバーアクションでの再検査の両方から呼ぶ。
 */
export const findTransitionBlockers = async (
  target: ProjectStatus,
  companyId: number,
): Promise<string[]> => {
  if (target === "employment_contract_pending") return checkCompanyReady(companyId)
  if (target === "employment_contract_completed") return checkEmploymentContracts(companyId)
  return []
}
