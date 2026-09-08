import type { EmploymentType, Gender } from "@/db/schema"
import { DeleteDialog } from "@/components/delete-dialog"
import { FormDialog } from "@/components/form-dialog"
import { Th } from "@/components/ui"
import { TraineeForm } from "@/components/trainee-form"
import {
  createTraineeAction,
  deleteTraineeAction,
  updateTraineeAction,
} from "@/lib/trainees/actions"
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS } from "@/lib/trainees/labels"

export type CompanyTrainee = {
  id: number
  name: string
  nameKana: string
  insuranceNumber: string
  employmentType: EmploymentType
  jobType: string
  jobDescription: string
  gender: Gender
  /** 保存できたらダイアログを閉じるための目印。保存のたびに必ず変わる */
  updatedAt: Date
}

/**
 * D-03 会社詳細の受講者（5.6）。
 *
 * 受講者は1社にだけ属し、会社をまたいで付け替えるものではないため、
 * 会社を選ばせる独立した画面を作らず、会社詳細のタブ内で登録・編集・削除まで行う。
 *
 * 一覧は他の画面（G-01 / D-01）と同じテーブルにそろえる。編集はモーダルで開く。
 */
export function CompanyTrainees({
  companyId,
  trainees,
}: {
  companyId: number
  trainees: CompanyTrainee[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">受講者</h2>
          <p className="mt-1 text-sm text-slate-600">
            研修を受ける方を登録します。申請案件のステータスを先へ進めるには、
            受講者が1人以上登録されている必要があります。
          </p>
        </div>
        {/* 登録できたら閉じる。件数が増えたことで判定する */}
        <FormDialog
          triggerLabel="新規作成"
          triggerDescription="受講者"
          title="受講者を登録"
          closeToken={trainees.length}
        >
          <TraineeForm
            action={createTraineeAction.bind(null, companyId)}
            submitLabel="登録する"
            framed={false}
          />
        </FormDialog>
      </div>

      {trainees.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          この会社の受講者はまだ登録されていません。右上の「新規作成」から追加します。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <caption className="sr-only">この会社の受講者の一覧。全 {trainees.length} 件。</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <Th>氏名</Th>
                <Th>フリガナ</Th>
                <Th>雇用保険被保険者番号</Th>
                <Th>雇用形態</Th>
                <Th>職種</Th>
                <Th>職務内容</Th>
                <Th>性別</Th>
                {/* 中身は鉛筆だけなので、見出しは読み上げにだけ渡す */}
                <Th className="w-px">
                  <span className="sr-only">操作</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((trainee) => (
                <tr
                  key={trainee.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-900">
                    {trainee.name}
                  </th>
                  <td className="px-4 py-2.5 text-slate-600">{trainee.nameKana}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {trainee.insuranceNumber}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {EMPLOYMENT_TYPE_LABELS[trainee.employmentType]}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{trainee.jobType}</td>
                  <td className="px-4 py-2.5 text-slate-600">{trainee.jobDescription}</td>
                  <td className="px-4 py-2.5 text-slate-600">{GENDER_LABELS[trainee.gender]}</td>
                  <td className="px-4 py-2.5 text-right">
                    <FormDialog
                      triggerVariant="icon"
                      triggerLabel={`${trainee.name} を編集`}
                      title={`${trainee.name} の編集`}
                      // 保存できたら閉じる。updatedAt は保存のたびに必ず変わる
                      closeToken={trainee.updatedAt.getTime()}
                    >
                      <div className="flex flex-col gap-6">
                        <TraineeForm
                          action={updateTraineeAction.bind(null, trainee.id, companyId)}
                          values={{
                            name: trainee.name,
                            nameKana: trainee.nameKana,
                            insuranceNumber: trainee.insuranceNumber,
                            employmentType: trainee.employmentType,
                            jobType: trainee.jobType,
                            jobDescription: trainee.jobDescription,
                            gender: trainee.gender,
                          }}
                          submitLabel="保存する"
                          framed={false}
                        />

                        <div className="flex flex-col gap-3 border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-bold text-red-700">受講者の削除</h3>
                          {/* 影響の内訳は確認ダイアログが持つ。ここで先に並べると二重になる */}
                          <div>
                            <DeleteDialog
                              action={deleteTraineeAction.bind(null, trainee.id, companyId)}
                              title="受講者を完全に削除しますか"
                              targetName={`${trainee.name}（${trainee.nameKana}）`}
                              consequences={[
                                "所属しているチームからも削除されます。",
                                "この受講者の雇用契約書も削除されます。",
                                "研修完了後の過去記録にも、この受講者の名前は残りません。",
                                "削除履歴には記録されません。",
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    </FormDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
