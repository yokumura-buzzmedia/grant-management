import { mkdir, rm, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

/**
 * 開発用のファイル保管。本番は S3（03_技術選定.md 4.6）。
 *
 * キーはサーバーが組み立てたものだけを受け取るが、署名を偽装されても
 * 保管先の外へ出られないよう、ここでも境界を確認する。
 */
const ROOT = path.resolve(process.cwd(), ".uploads")

const resolveKey = (key: string) => {
  const target = path.resolve(ROOT, key)
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    throw new Error("保管先の外を指すキーです。")
  }
  return target
}

export const putObject = async (key: string, body: Buffer) => {
  const target = resolveKey(key)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, body)
}

export const getObject = async (key: string) => readFile(resolveKey(key))

/** 差し替え時に前のファイルを消す（履歴を保持しない方針・5.2）。既に無くてもエラーにしない */
export const deleteObject = async (key: string) => {
  await rm(resolveKey(key), { force: true })
}
