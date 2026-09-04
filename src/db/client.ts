import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error("DATABASE_URL が設定されていません。.env.local を確認してください。")
}

const createPool = () => {
  const pool = mysql.createPool({
    uri: url,
    /**
     * datetime を UTC として送受信する。
     * 日時はすべて UTC で保存し、表示時に JST へ変換する（04_DB論理設計.md）。
     */
    timezone: "Z",
    connectionLimit: 10,
    supportBigNumbers: true,
  })

  /**
   * 接続の照合順序を列と揃える。
   *
   * ハンドシェイクの文字セット欄は1バイトのため、ID が 303 の utf8mb4_ja_0900_as_cs を
   * 接続オプションでは指定できない。接続確立時に SET NAMES で設定する。
   * 列同士・列と値の比較は列の照合順序が優先されるが、値同士の比較や式の照合順序も
   * 揃えておかないと、濁点・半濁点や大文字小文字の扱いが場所によって変わる。
   */
  pool.on("connection", (connection) => {
    connection.query("set names utf8mb4 collate utf8mb4_ja_0900_as_cs")
  })

  return pool
}

/** 開発時の HMR で接続プールが増え続けないよう globalThis に保持する。 */
const globalForDb = globalThis as typeof globalThis & { __grantPool?: mysql.Pool }

const pool = globalForDb.__grantPool ?? createPool()
if (process.env.NODE_ENV !== "production") globalForDb.__grantPool = pool

export const db = drizzle(pool, { schema, mode: "default" })
export { pool }
