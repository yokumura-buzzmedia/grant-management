/**
 * カリキュラムマスタの定義（01_要件定義.md 5.7）。
 *
 * 取り込みの実装（`import.ts`）から切り離してある。
 * F-02 の画面はクライアントコンポーネントで、ここの見出しとファイル名を使う。
 * DB へ接続する `import.ts` をクライアント側から読むと、mysql2 が
 * ブラウザ向けのバンドルに入ってビルドが通らない。
 */

/**
 * 1コースの講義コマの所要時間の合計（5.7）。
 * コマ数は可変で、何コマに分けても合計はこの時間にそろえる。
 */
export const COURSE_TOTAL_HOURS = 10

/** 受講日数の範囲。開催パターンは2日間〜5日間（5.7）。 */
export const MIN_PATTERN_DAYS = 2
export const MAX_PATTERN_DAYS = 5

/**
 * 取り込む順序でもある。
 * コースは研修プログラムと職種カテゴリを、講義コマはコースを参照するため、
 * 先に入っていないと参照先が見つからない。
 */
export const CURRICULUM_MASTERS = {
  programs: {
    label: "研修プログラム",
    file: "programs.csv",
    header: ["研修プログラムコード", "研修プログラム名", "段階", "表示順"],
  },
  categories: {
    label: "職種カテゴリ",
    file: "categories.csv",
    header: ["職種カテゴリコード", "職種カテゴリ名", "表示順"],
  },
  courses: {
    label: "コース",
    file: "courses.csv",
    header: [
      "研修プログラムコード",
      "職種カテゴリコード",
      "コース番号",
      "職種名",
      "目的",
      "表示順",
    ],
  },
  sessions: {
    label: "講義コマ",
    file: "sessions.csv",
    header: [
      "研修プログラムコード",
      "コース番号",
      "コマ記号",
      "表示順",
      "所要時間",
      "タイトル",
      "説明",
    ],
  },
  patterns: {
    label: "開催パターン",
    file: "patterns.csv",
    header: ["開催パターンコード", "開催パターン名", "受講日数", "時間内訳", "表示順"],
  },
  patternDays: {
    label: "パターン日別コマ割当",
    file: "pattern_days.csv",
    header: ["開催パターンコード", "日目", "コマ記号", "表示順"],
  },
} as const

export type MasterKey = keyof typeof CURRICULUM_MASTERS

/** 取り込み結果。画面でもそのまま件数を出せるようにしている。 */
export type MasterResult = {
  key: MasterKey
  label: string
  inserted: number
  updated: number
  unchanged: number
}

/** 取り込む CSV。マスタごとに1ファイルなので、一部だけの取り込みもできる。 */
export type CurriculumCsv = Partial<Record<MasterKey, string>>
