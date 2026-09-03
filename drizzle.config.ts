import { defineConfig } from "drizzle-kit"

/**
 * 助成金管理システム / Drizzle 設定
 *
 * 文字コードと照合順序は utf8mb4 / utf8mb4_ja_0900_as_cs を使用する。
 * 詳細は docs/設計/03_技術選定.md 4.2 を参照。
 */
export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
})
