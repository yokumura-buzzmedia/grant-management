/**
 * カリキュラムマスタの初期データを取り込む（01_要件定義.md 5.7）。
 *
 *   npm run db:curriculum              # docs/data/ から取り込む
 *   npm run db:curriculum -- <dir>     # 別のディレクトリから取り込む
 *
 * 6つの CSV をまとめて1つのトランザクションで取り込む。
 * 何度実行しても結果は同じで、変わっていない行は更新しない。
 * 取り込みの中身は src/lib/curriculum/import.ts にあり、F-02 CSVインポート画面と共有する。
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pool } from "./client"
import { importCurriculum } from "../lib/curriculum/import"
import {
  CURRICULUM_MASTERS,
  type CurriculumCsv,
  type MasterKey,
} from "../lib/curriculum/masters"

const DEFAULT_DIR = "docs/data"

const main = async () => {
  const dir = process.argv[2] ?? DEFAULT_DIR

  const files: CurriculumCsv = {}
  for (const key of Object.keys(CURRICULUM_MASTERS) as MasterKey[]) {
    const path = join(dir, CURRICULUM_MASTERS[key].file)
    try {
      files[key] = readFileSync(path, "utf8")
    } catch {
      throw new Error(`${path} を読み込めませんでした。`)
    }
  }
  console.log(`読み込み: ${dir}`)

  const results = await importCurriculum(files)

  console.log("")
  for (const result of results) {
    console.log(
      `  ${result.label.padEnd(12, "　")} 追加 ${result.inserted} 件 / ` +
        `更新 ${result.updated} 件 / 変更なし ${result.unchanged} 件`,
    )
  }
  console.log("")
  console.log("取り込み完了")
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
