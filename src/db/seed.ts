/**
 * ローカル開発用の初期データ投入。
 *
 *   npm run db:seed
 *
 * 初期のシステム管理者を1件作成し、仮パスワードを標準出力に表示する。
 * 実行前に照合順序を確認する。utf8mb4_ja_0900_as_cs でないと
 * ログインIDの大文字小文字が区別されず、要件5.4を満たせない。
 */
import type { RowDataPacket } from "mysql2"
import { eq } from "drizzle-orm"
import { db, pool } from "./client"
import { announcements, userRoles, users } from "./schema"
import { generateTemporaryPassword, hashPassword } from "../lib/auth/password"

const REQUIRED_COLLATION = "utf8mb4_ja_0900_as_cs"

const assertCollation = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `select collation_name as collation_name
       from information_schema.columns
      where table_schema = database() and table_name = 'users' and column_name = 'login_id'`,
  )
  const actual = rows[0]?.collation_name
  if (!actual) throw new Error("users テーブルがありません。先に npm run db:migrate を実行してください。")
  if (actual !== REQUIRED_COLLATION) {
    throw new Error(
      `users.login_id の照合順序が ${actual} です。${REQUIRED_COLLATION} が必要です。\n` +
        "npm run db:reset でボリュームごと作り直してください。",
    )
  }
  console.log(`照合順序: ${actual}`)
}

const main = async () => {
  await assertCollation()

  const loginId = process.env.SEED_ADMIN_LOGIN_ID ?? "admin001"
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? "初期管理者"

  // お知らせは単一行（id = 1）。無効の状態で用意しておく（5.23）
  const now = new Date()
  await db
    .insert(announcements)
    .values({ id: 1, isEnabled: false, body: null, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { id: 1 } })

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.loginId, loginId))
    .limit(1)

  if (existing) {
    console.log(`ログインID ${loginId} は既にあります。作成をとばしました。`)
    return
  }

  const temporaryPassword = generateTemporaryPassword()
  const [result] = await db.insert(users).values({
    loginId,
    displayName,
    passwordHash: await hashPassword(temporaryPassword),
    isTemporaryPassword: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  const userId = Number(result.insertId)
  await db.insert(userRoles).values({ userId, role: "admin", createdAt: now })

  console.log("")
  console.log("初期システム管理者を作成しました。")
  console.log(`  ログインID   : ${loginId}`)
  console.log(`  利用者名     : ${displayName}`)
  console.log(`  仮パスワード : ${temporaryPassword}`)
  console.log("")
  console.log("初回ログイン後に、新しいパスワードの設定を求められます。")
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
