/**
 * 日本郵便の郵便番号データを取り込む（05_外部連携仕様.md 5）。
 *
 *   npm run db:postal              # 日本郵便からダウンロードして取り込む
 *   npm run db:postal -- <path>    # ダウンロード済みの zip または csv を取り込む
 *
 * 洗い替え（全件入れ替え）をトランザクション内で行う。
 * 失敗した場合はロールバックされ、既存データが残る。
 * 本番では EventBridge Scheduler から月次で ECS の単発タスクとして起動する。
 */
import { readFileSync } from "node:fs"
import { inflateRawSync } from "node:zlib"
import { sql } from "drizzle-orm"
import { db, pool } from "./client"
import { postalCodes } from "./schema"

const SOURCE_URL =
  "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip"

/** 一度に INSERT する行数。 */
const CHUNK_SIZE = 2000

// ---------------------------------------------------------------------------
// ZIP の展開
// ---------------------------------------------------------------------------

/**
 * 単一ファイルの ZIP を展開する。
 * 依存を増やさないため、中央ディレクトリを読んで deflate を展開するだけの実装にしている。
 */
const extractZip = (buffer: Buffer) => {
  const EOCD_SIGNATURE = 0x06054b50
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("ZIP の終端レコードが見つかりません。")

  const entryCount = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)

  for (let i = 0; i < entryCount; i++) {
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8")

    if (name.toLowerCase().endsWith(".csv")) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26)
      const localExtraLength = buffer.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const data = buffer.subarray(start, start + compressedSize)
      return method === 8 ? inflateRawSync(data) : Buffer.from(data)
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  throw new Error("ZIP に CSV が含まれていません。")
}

// ---------------------------------------------------------------------------
// CSV の解析
// ---------------------------------------------------------------------------

/** 引用符つきの1行を分解する。町域名にカンマが含まれる行があるため、素朴な split は使わない。 */
const parseCsvLine = (line: string) => {
  const fields: string[] = []
  let current = ""
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      fields.push(current)
      current = ""
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

/**
 * 町域名を表示用に整える。
 *
 * - 「以下に掲載がない場合」「〇〇の次に番地がくる場合」は町域なしとして扱う
 * - 「大通西（１〜１９丁目）」のような補足は括弧の手前で切る。
 *   括弧の中身が複数行に分かれている行も、これで実質的に取り除ける
 */
const cleanTown = (raw: string): string | null => {
  if (raw.includes("以下に掲載がない場合")) return null
  if (/の次に番地がくる場合$/.test(raw)) return null

  const parenthesis = raw.indexOf("（")
  const town = (parenthesis >= 0 ? raw.slice(0, parenthesis) : raw).trim()
  return town === "" ? null : town
}

type Row = { postalCode: string; prefecture: string; city: string; town: string | null }

const parseRows = (csv: string): Row[] => {
  const seen = new Set<string>()
  const rows: Row[] = []

  for (const line of csv.split(/\r?\n/)) {
    if (line.trim() === "") continue
    const fields = parseCsvLine(line)
    const postalCode = fields[2]?.trim()
    const prefecture = fields[6]?.trim()
    const city = fields[7]?.trim()
    if (!postalCode || !prefecture || !city) continue

    const town = cleanTown(fields[8]?.trim() ?? "")

    // 括弧を落とすと、同じ町域が複数行に分かれていた行が重複する
    const key = `${postalCode}|${prefecture}|${city}|${town ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({ postalCode, prefecture, city, town })
  }
  return rows
}

// ---------------------------------------------------------------------------

const load = async (source: string | undefined) => {
  if (source) {
    const buffer = readFileSync(source)
    console.log(`読み込み: ${source}`)
    return source.toLowerCase().endsWith(".zip") ? extractZip(buffer) : buffer
  }

  console.log(`ダウンロード: ${SOURCE_URL}`)
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`ダウンロードに失敗しました（${response.status}）。`)
  return extractZip(Buffer.from(await response.arrayBuffer()))
}

const main = async () => {
  const csv = (await load(process.argv[2])).toString("utf8")
  const rows = parseRows(csv)
  if (rows.length < 100_000) {
    throw new Error(`取り込み対象が ${rows.length} 件しかありません。データを確認してください。`)
  }
  console.log(`解析: ${rows.length} 件`)

  const updatedAt = new Date()
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from ${postalCodes}`)
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      await tx.insert(postalCodes).values(
        rows.slice(i, i + CHUNK_SIZE).map((row) => ({ ...row, updatedAt })),
      )
    }
  })

  console.log(`取り込み完了: ${rows.length} 件`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
