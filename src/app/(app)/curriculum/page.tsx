import Link from "next/link"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/db/client"
import {
  courseSessions,
  courses,
  jobCategories,
  patternDaySessions,
  sessionPatterns,
  trainingPrograms,
} from "@/db/schema"
import {
  CategoryForm,
  CourseForm,
  PatternDaysForm,
  PatternForm,
  ProgramForm,
  SessionForm,
} from "@/components/curriculum-forms"
import { CurriculumDayBoard, type BoardItem } from "@/components/curriculum-day-board"
import { DeleteDialog } from "@/components/delete-dialog"
import { FormDialog } from "@/components/form-dialog"
import { SubmitButton } from "@/components/form"
import { buttonSecondary, focusRing, Notice, PageHeader } from "@/components/ui"
import { requireRoles } from "@/lib/auth/guards"
import {
  createCategoryAction,
  createCourseAction,
  createPatternAction,
  createProgramAction,
  createSessionAction,
  deleteCategoryAction,
  deleteCourseAction,
  deletePatternAction,
  deleteProgramAction,
  deleteSessionAction,
  arrangeDayAction,
  toggleCourseActiveAction,
  toggleMasterActiveAction,
  updateCategoryAction,
  updateCourseAction,
  updatePatternAction,
  updatePatternDaysAction,
  updateProgramAction,
  updateSessionAction,
} from "@/lib/curriculum/actions"
import { COURSE_TOTAL_HOURS } from "@/lib/curriculum/masters"
import { curriculumHref, pickView, type CurriculumView } from "@/lib/curriculum/view"

/**
 * F-01 カリキュラムマスタ（01_要件定義.md 5.7）。
 *
 * 研修プログラム → 職種カテゴリ → コース → 開催パターン と上から選び、
 * 選んだ1コースを開催パターンの日程に当てはめて見る。クライアントに渡している
 * 案内と同じ並びにしてあるので、画面を見ながら内容を突き合わせられる。
 *
 * 追加・編集・削除は各段の右端から行う。編集は鉛筆で、いま選んでいるものを対象にする。
 * 段ごとに全件へ操作を出すと、講義コマの一覧より先に操作の列が並んでしまう。
 */

const NOTICES: Record<string, string> = {
  created: "追加しました。",
  saved: "保存しました。",
  deleted: "削除しました。",
  activated: "有効に戻しました。新規のチームで選べます。",
  deactivated:
    "無効にしました。新規のチームでは選べません。既存のチームの内容は変わりません。",
  courseCreated:
    "コースを追加しました。講義コマはまだありません。「講義コマを追加」から登録してください。",
  sessionCreated:
    "講義コマを追加しました。どの開催パターンでも初日に置いています。下の「日程を変更」から、開催パターンごとに日を決めてください。",
  patternCreated:
    "開催パターンを追加しました。全コースの講義コマを初日に置いてあります。下の「日程を変更」から、コースごとに日を決めてください。",
}

const ERRORS: Record<string, string> = {
  notFound: "対象が見つかりませんでした。すでに削除された可能性があります。",
  referenced:
    "チームから参照されているため削除できません。無効にすると、新規のチームの選択肢から外せます。",
  programHasCourses:
    "この研修プログラムにコースが残っているため削除できません。先にコースを削除してください。",
  categoryHasCourses:
    "この職種カテゴリにコースが残っているため削除できません。先にコースを削除してください。",
  lastSession:
    "このコース最後の講義コマのため削除できません。コマのないコースは開催パターンに当てはめられません。",
}

/** 0.5時間単位。1.0 は「1時間」と出す */
const hours = (value: number) => `${Number(value.toFixed(1))}時間`

const pillBase =
  "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap " + focusRing
const pillOn = pillBase + " border-slate-900 bg-slate-900 font-medium text-white"
const pillOff = pillBase + " border-slate-300 bg-white text-slate-700 hover:bg-slate-50"

type PillItem = {
  key: string
  href: string
  label: string
  /** ラベルに添える細かい情報（コース番号や受講日数） */
  note?: string
  current: boolean
  isActive: boolean
}

/**
 * 選択の1段。
 * 選んでいるものは aria-current で伝える。色だけでは選択が分からない。
 */
function PillRow({
  id,
  label,
  items,
  emptyText,
  edit,
  add,
}: {
  /** ラベルとリストを結ぶ。段は見出しではなく選択肢の並びなので、h2 にはしない */
  id: string
  label: string
  items: PillItem[]
  emptyText: string
  /** いま選んでいるものの編集。選ぶものがなければ渡さない */
  edit?: React.ReactNode
  add: React.ReactNode
}) {
  // ピルは折り返さない語のかたまりで、幅が足りなくても縮まない。
  // 1行に並べると狭い画面で操作ボタンと重なるため、格子で置き場所を決める。
  // 狭いとき: 1行目にラベルと操作、2行目にピル。広いとき: 3列で1行
  const cell = "col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-3 last:border-0 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start">
      <span
        id={id}
        className="col-start-1 row-start-1 self-center text-sm font-medium text-slate-500 sm:self-start sm:pt-2"
      >
        {label}
      </span>
      {items.length === 0 ? (
        <p className={cell + " text-sm text-slate-500 sm:pt-2"}>{emptyText}</p>
      ) : (
        <ul aria-labelledby={id} className={cell + " flex flex-wrap gap-2"}>
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={item.current ? "true" : undefined}
                className={item.current ? pillOn : pillOff}
              >
                {item.label}
                {item.note ? (
                  <span className={item.current ? "ml-1.5 text-xs" : "ml-1.5 text-xs text-slate-500"}>
                    {item.note}
                  </span>
                ) : null}
                {item.isActive ? null : (
                  <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                    無効
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-3">
        {edit}
        {add}
      </div>
    </div>
  )
}

/**
 * 有効／無効の切り替え。
 * 確認をとらない。無効にしても既存のチームの内容は変わらず、すぐ元に戻せる（5.7）。
 */
function ActiveToggle({
  kind,
  isActive,
  action,
}: {
  kind: string
  isActive: boolean
  action: () => Promise<void>
}) {
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">
        {isActive
          ? `この${kind}は有効です。新規のチームで選べます。`
          : `この${kind}は無効です。新規のチームでは選べません。`}
      </p>
      {/* 押したあと再描画までの間、押せたことが分からないと二度押しされる */}
      <SubmitButton variant="secondary" fullWidth={false}>
        {isActive ? "無効にする" : "有効に戻す"}
      </SubmitButton>
    </form>
  )
}

/** 編集ダイアログの中の削除。影響の内訳は確認ダイアログが持つ */
function DeleteSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-6">
      <h3 className="text-sm font-bold text-red-700">削除</h3>
      <div>{children}</div>
    </div>
  )
}

function Divider({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-slate-200 pt-6">{children}</div>
}

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRoles(["staff", "admin"])
  const params = await searchParams
  const requested = pickView(params)
  const raw = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined
  const notice = raw("notice")
  const error = raw("error")

  const [programs, categories, patterns] = await Promise.all([
    db.select().from(trainingPrograms).orderBy(asc(trainingPrograms.displayOrder)),
    db.select().from(jobCategories).orderBy(asc(jobCategories.displayOrder)),
    db.select().from(sessionPatterns).orderBy(asc(sessionPatterns.displayOrder)),
  ])

  // URL の指定が消えたもの・存在しないものを指していたら、先頭に落とす。
  // 空の画面を出すより、何か1つ選ばれている状態から始めたほうが操作しやすい
  const program = programs.find((row) => row.code === requested.program) ?? programs[0]
  const category = categories.find((row) => row.code === requested.category) ?? categories[0]
  const pattern = patterns.find((row) => row.code === requested.pattern) ?? patterns[0]

  const courseRows =
    program && category
      ? await db
          .select()
          .from(courses)
          .where(
            and(eq(courses.programCode, program.code), eq(courses.categoryCode, category.code)),
          )
          .orderBy(asc(courses.displayOrder))
      : []
  const course = courseRows.find((row) => String(row.id) === requested.course) ?? courseRows[0]

  const [sessions, dayRows] = await Promise.all([
    course
      ? db
          .select()
          .from(courseSessions)
          .where(eq(courseSessions.courseId, course.id))
          .orderBy(asc(courseSessions.displayOrder))
      : [],
    // 割当はコースごとに持つ。開いているコースの分だけを読む（5.7）
    pattern && course
      ? db
          .select({
            id: patternDaySessions.id,
            courseSessionId: patternDaySessions.courseSessionId,
            dayNumber: patternDaySessions.dayNumber,
            displayOrder: patternDaySessions.displayOrder,
          })
          .from(patternDaySessions)
          .innerJoin(courseSessions, eq(courseSessions.id, patternDaySessions.courseSessionId))
          .where(
            and(
              eq(patternDaySessions.patternCode, pattern.code),
              eq(courseSessions.courseId, course.id),
            ),
          )
          .orderBy(asc(patternDaySessions.dayNumber), asc(patternDaySessions.displayOrder))
      : [],
  ])

  /** 追加・編集のあとに戻ってくる先。落ちた指定は補正後の値で持ち回る */
  const view: CurriculumView = {
    program: program?.code,
    category: category?.code,
    course: course ? String(course.id) : undefined,
    pattern: pattern?.code,
  }

  const totalHours = sessions.reduce((sum, session) => sum + Number(session.durationHours), 0)
  // コマ数が可変になったぶん、合計が10時間から外れたまま気づかない状態を作りたくない（5.7）
  const hoursMatched = totalHours === COURSE_TOTAL_HOURS

  // 日の中の並びは開催パターン側の表示順で決まる。コース側のコマ順とは別に持つ
  const dayOf = new Map(dayRows.map((row) => [row.courseSessionId, row]))

  const categoryOptions = categories.map((row) => ({ value: row.code, label: row.name }))

  /** 講義コマ1件のカードの中身。外枠と並べ替えは日程の板が持つ */
  const sessionCard = (session: (typeof sessions)[number]) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
            {hours(Number(session.durationHours))}
          </span>
          <span className="font-mono text-xs text-slate-500">{session.sessionSymbol}</span>
        </span>
        <FormDialog
          triggerVariant="icon"
          triggerLabel={`${session.title} を編集`}
          title={`${session.title}の編集`}
        >
          <div className="flex flex-col gap-6">
            <SessionForm
              action={updateSessionAction.bind(null, session.id, view)}
              values={{
                sessionSymbol: session.sessionSymbol,
                // ドラッグで動くのは開催パターン側の表示順。コース側の値は出さない
                orderText: (() => {
                  const assigned = dayOf.get(session.id)
                  return assigned
                    ? `${pattern?.name ?? ""}　${assigned.dayNumber} 日目の ${assigned.displayOrder} 番目`
                    : "未割当"
                })(),
                durationHours: session.durationHours,
                title: session.title,
                description: session.description,
              }}
              submitLabel="保存する"
            />
            <DeleteSection>
              <DeleteDialog
                action={deleteSessionAction.bind(null, session.id, view)}
                title="講義コマを完全に削除しますか"
                targetName={`${session.sessionSymbol}　${session.title}`}
                consequences={[
                  "全ての開催パターンから、このコマの日別割当も削除されます。",
                  `削除するとこのコースの合計は ${hours(totalHours - Number(session.durationHours))} になります。`,
                ]}
              />
            </DeleteSection>
          </div>
        </FormDialog>
      </div>

      <h4 className="text-sm font-bold text-slate-900">{session.title}</h4>
      {session.description ? (
        <p className="text-sm leading-relaxed text-slate-600">{session.description}</p>
      ) : null}
    </>
  )

  const boardItems: BoardItem[] = sessions
    .map((session) => ({
      id: session.id,
      day: dayOf.get(session.id)?.dayNumber ?? null,
      // 割当が無いコマはコース側の順で並べる
      order: dayOf.get(session.id)?.displayOrder ?? session.displayOrder,
      sessionSymbol: session.sessionSymbol,
      durationHours: Number(session.durationHours),
      card: sessionCard(session),
    }))
    .sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="カリキュラム"
        description="上から順に選ぶと、そのコースの内容を開催パターンの日程に当てはめて表示します。追加・編集は各段の右端から行います。"
      />

      {notice && NOTICES[notice] ? <Notice>{NOTICES[notice]}</Notice> : null}
      {error && ERRORS[error] ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {ERRORS[error]}
        </p>
      ) : null}

      <section
        aria-label="表示するカリキュラムの選択"
        className="rounded-lg border border-slate-200 bg-white"
      >
        {/* 研修プログラム */}
        <PillRow
          id="pick-program"
          label="研修プログラム"
          emptyText="研修プログラムがありません。右の「追加」から登録してください。"
          items={programs.map((row) => ({
            key: row.code,
            // 研修プログラムを変えるとコースも変わる。選び直させる
            href: curriculumHref(view, { program: row.code, course: undefined }),
            label: row.name,
            note: row.stage,
            current: row.code === program?.code,
            isActive: row.isActive,
          }))}
          edit={
            program ? (
              <FormDialog
                triggerVariant="icon"
                triggerLabel={`${program.name} を編集`}
                title={`${program.name}の編集`}
              >
                <div className="flex flex-col gap-6">
                  <ProgramForm
                    action={updateProgramAction.bind(null, program.code, view)}
                    values={{
                      code: program.code,
                      name: program.name,
                      stage: program.stage,
                      displayOrder: program.displayOrder,
                    }}
                    submitLabel="保存する"
                  />
                  <Divider>
                    <ActiveToggle
                      kind="研修プログラム"
                      isActive={program.isActive}
                      action={toggleMasterActiveAction.bind(null, "programs", program.code, view)}
                    />
                  </Divider>
                  <DeleteSection>
                    <DeleteDialog
                      action={deleteProgramAction.bind(null, program.code, view)}
                      title="研修プログラムを完全に削除しますか"
                      targetName={program.name}
                      consequences={[
                        "コースが1つでも残っていると削除できません。",
                        "チームから参照されている場合も削除できません。",
                        "残したまま新規の選択肢から外すには、無効にしてください。",
                      ]}
                    />
                  </DeleteSection>
                </div>
              </FormDialog>
            ) : null
          }
          add={
            <FormDialog
              triggerVariant="secondary"
              triggerLabel="追加"
              triggerDescription="研修プログラム"
              title="研修プログラムの追加"
            >
              <ProgramForm action={createProgramAction.bind(null, view)} submitLabel="追加する" />
            </FormDialog>
          }
        />

        {/* 職種カテゴリ */}
        <PillRow
          id="pick-category"
          label="職種カテゴリ"
          emptyText="職種カテゴリがありません。右の「追加」から登録してください。"
          items={categories.map((row) => ({
            key: row.code,
            href: curriculumHref(view, { category: row.code, course: undefined }),
            label: row.name,
            current: row.code === category?.code,
            isActive: row.isActive,
          }))}
          edit={
            category ? (
              <FormDialog
                triggerVariant="icon"
                triggerLabel={`${category.name} を編集`}
                title={`${category.name}の編集`}
              >
                <div className="flex flex-col gap-6">
                  <CategoryForm
                    action={updateCategoryAction.bind(null, category.code, view)}
                    values={{
                      code: category.code,
                      name: category.name,
                      displayOrder: category.displayOrder,
                    }}
                    submitLabel="保存する"
                  />
                  <Divider>
                    <ActiveToggle
                      kind="職種カテゴリ"
                      isActive={category.isActive}
                      action={toggleMasterActiveAction.bind(
                        null,
                        "categories",
                        category.code,
                        view,
                      )}
                    />
                  </Divider>
                  <DeleteSection>
                    <DeleteDialog
                      action={deleteCategoryAction.bind(null, category.code, view)}
                      title="職種カテゴリを完全に削除しますか"
                      targetName={category.name}
                      consequences={[
                        "コースが1つでも残っていると削除できません。",
                        "チームから参照されている場合も削除できません。",
                        "残したまま新規の選択肢から外すには、無効にしてください。",
                      ]}
                    />
                  </DeleteSection>
                </div>
              </FormDialog>
            ) : null
          }
          add={
            <FormDialog
              triggerVariant="secondary"
              triggerLabel="追加"
              triggerDescription="職種カテゴリ"
              title="職種カテゴリの追加"
            >
              <CategoryForm action={createCategoryAction.bind(null, view)} submitLabel="追加する" />
            </FormDialog>
          }
        />

        {/* コース */}
        <PillRow
          id="pick-course"
          label="コース"
          emptyText="この組み合わせのコースはありません。"
          items={courseRows.map((row) => ({
            key: String(row.id),
            href: curriculumHref(view, { course: String(row.id) }),
            label: row.jobName,
            note: row.courseNumber,
            current: row.id === course?.id,
            isActive: row.isActive,
          }))}
          edit={
            course && program ? (
              <FormDialog
                triggerVariant="icon"
                triggerLabel={`${course.jobName} を編集`}
                title={`${course.jobName}の編集`}
              >
                <div className="flex flex-col gap-6">
                  <CourseForm
                    action={updateCourseAction.bind(null, course.id, view)}
                    categories={categoryOptions}
                    values={{
                      programName: program.name,
                      courseNumber: course.courseNumber,
                      categoryCode: course.categoryCode,
                      jobName: course.jobName,
                      purpose: course.purpose,
                      displayOrder: course.displayOrder,
                    }}
                    submitLabel="保存する"
                  />
                  <Divider>
                    <ActiveToggle
                      kind="コース"
                      isActive={course.isActive}
                      action={toggleCourseActiveAction.bind(null, course.id, view)}
                    />
                  </Divider>
                  <DeleteSection>
                    <DeleteDialog
                      action={deleteCourseAction.bind(null, course.id, view)}
                      title="コースを完全に削除しますか"
                      targetName={`${course.jobName}（コース番号 ${course.courseNumber}）`}
                      consequences={[
                        `このコースの講義コマ ${sessions.length} 件も削除されます。`,
                        "チームから参照されている場合は削除できません。",
                        "残したまま新規の選択肢から外すには、無効にしてください。",
                      ]}
                    />
                  </DeleteSection>
                </div>
              </FormDialog>
            ) : null
          }
          add={
            program ? (
              <FormDialog
                triggerVariant="secondary"
                triggerLabel="追加"
                triggerDescription="コース"
                title="コースの追加"
              >
                <CourseForm
                  action={createCourseAction.bind(null, view)}
                  categories={categoryOptions}
                  program={{ code: program.code, name: program.name }}
                  submitLabel="追加する"
                />
              </FormDialog>
            ) : null
          }
        />

        {/* 開催パターン */}
        <PillRow
          id="pick-pattern"
          label="開催パターン"
          emptyText="開催パターンがありません。右の「追加」から登録してください。"
          items={patterns.map((row) => ({
            key: row.code,
            href: curriculumHref(view, { pattern: row.code }),
            label: row.name,
            note: `${row.days}日`,
            current: row.code === pattern?.code,
            isActive: row.isActive,
          }))}
          edit={
            pattern ? (
              <FormDialog
                triggerVariant="icon"
                triggerLabel={`${pattern.name} を編集`}
                title={`${pattern.name}の編集`}
              >
                <div className="flex flex-col gap-6">
                  <PatternForm
                    action={updatePatternAction.bind(null, pattern.code, view)}
                    values={{
                      code: pattern.code,
                      name: pattern.name,
                      days: pattern.days,
                      timeBreakdown: pattern.timeBreakdown,
                      displayOrder: pattern.displayOrder,
                    }}
                    submitLabel="保存する"
                  />
                  <Divider>
                    <ActiveToggle
                      kind="開催パターン"
                      isActive={pattern.isActive}
                      action={toggleMasterActiveAction.bind(null, "patterns", pattern.code, view)}
                    />
                  </Divider>
                  <DeleteSection>
                    <DeleteDialog
                      action={deletePatternAction.bind(null, pattern.code, view)}
                      title="開催パターンを完全に削除しますか"
                      targetName={pattern.name}
                      consequences={[
                        "日別コマ割当も一緒に削除されます。",
                        "チームから参照されている場合は削除できません。",
                        "残したまま新規の選択肢から外すには、無効にしてください。",
                      ]}
                    />
                  </DeleteSection>
                </div>
              </FormDialog>
            ) : null
          }
          add={
            <FormDialog
              triggerVariant="secondary"
              triggerLabel="追加"
              triggerDescription="開催パターン"
              title="開催パターンの追加"
            >
              <PatternForm action={createPatternAction.bind(null, view)} submitLabel="追加する" />
            </FormDialog>
          }
        />
      </section>

      {course && program && category ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">{course.jobName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {program.name} ／ {category.name} ／ コース番号 {course.courseNumber} ／{" "}
            {sessions.length} コマ 合計 {hours(totalHours)}
          </p>
          {hoursMatched ? null : (
            // 1コマずつの編集では合計が外れたまま保存できる。気づける場所をここに置く
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              所要時間の合計が {hours(totalHours)} です。1コースの合計は{" "}
              {COURSE_TOTAL_HOURS} 時間にそろえてください。
            </p>
          )}
          <h3 className="mt-5 text-sm font-medium text-slate-500">目的</h3>
          {/* CSV の「目的」は改行を含む。段落として保持する（5.7） */}
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {course.purpose}
          </p>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <FormDialog
              triggerVariant="secondary"
              triggerLabel="講義コマを追加"
              title={`${course.jobName}への講義コマの追加`}
            >
              <SessionForm
                action={createSessionAction.bind(null, course.id, view)}
                submitLabel="追加する"
              />
            </FormDialog>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          表示するコースがありません。上の「コース」の「追加」から登録してください。
        </p>
      )}

      {course && pattern ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 補足は見出しの外に出す。中に入れると読み上げの見出し名が
                「2日間コースの日程受講日数 2 日 ／ …」と1つの長い名前になる */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-bold text-slate-900">{pattern.name}の日程</h2>
              <p className="text-sm text-slate-500">
                受講日数 {pattern.days} 日 ／ 時間内訳 {pattern.timeBreakdown}
              </p>
              {/* ドラッグはマウスだけの手段。同じことができる導線が隣にあることを伝える */}
              <p className="basis-full text-sm text-slate-500">
                カードをドラッグすると、別の日へ移したり日の中の順を入れ替えたりできます。
                「日程を変更」からは一覧で日を決められます。
              </p>
            </div>
            {/* 開催パターンの編集ではなく日程の側に置く。
                「このコースをどう割り振るか」は、マスタの項目を直す操作とは別のこと */}
            <FormDialog
              triggerVariant="secondary"
              triggerLabel="日程を変更"
              triggerDescription={`${course.jobName}／${pattern.name}`}
              title={`${course.jobName}：${pattern.name}の日程`}
            >
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600">
                  このコースの日程です。コースごとに決めるので、他のコースの日程は変わりません。
                </p>
                <PatternDaysForm
                  action={updatePatternDaysAction.bind(null, pattern.code, view)}
                  days={pattern.days}
                  rows={sessions.map((session) => ({
                    id: session.id,
                    sessionSymbol: session.sessionSymbol,
                    dayNumber: dayOf.get(session.id)?.dayNumber ?? 1,
                    title: session.title,
                  }))}
                  submitLabel="日程を保存する"
                />
              </div>
            </FormDialog>
          </div>

          <CurriculumDayBoard
            dayCount={pattern.days}
            items={boardItems}
            onArrange={arrangeDayAction.bind(null, pattern.code)}
          />
        </>
      ) : null}
    </div>
  )
}
