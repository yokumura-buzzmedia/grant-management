/**
 * マイグレーションを適用する。ECS の単発タスクとして実行する（03_技術選定.md 5.6）。
 *
 * ローカルの `npm run db:migrate` は drizzle-kit を使うが、これは devDependency で
 * 実行用イメージには入らない。ここでは drizzle-orm の migrator を直接呼ぶ。
 * 必要なのは drizzle/ 配下の SQL と meta/_journal.json だけで、
 * スキーマの TypeScript も drizzle.config.ts も要らない。
 *
 * 接続先は環境変数 DATABASE_URL。ECS のタスク定義が Secrets Manager から渡す。
 */
import mysql from "mysql2/promise"
import { drizzle } from "drizzle-orm/mysql2"
import { migrate } from "drizzle-orm/mysql2/migrator"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL が設定されていません。")
  process.exit(1)
}

const connection = await mysql.createConnection({ uri: url })

try {
  // 照合順序を列と揃える。src/db/client.ts と同じ理由（04_DB論理設計.md）。
  await connection.query("set names utf8mb4 collate utf8mb4_ja_0900_as_cs")

  await migrate(drizzle(connection), { migrationsFolder: "./drizzle" })
  console.log("マイグレーションを適用しました。")
} catch (error) {
  console.error("マイグレーションに失敗しました。")
  console.error(error)
  process.exitCode = 1
} finally {
  await connection.end()
}
