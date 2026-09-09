/**
 * CSV の読み取り。
 *
 * `docs/data/` の初期データは UTF-8 BOM 付きで、`courses.csv` の「目的」列には
 * 引用符に囲まれた改行が入る。行で分割してから列に切る実装では壊れるため、
 * 1文字ずつ読んで引用符の内と外を判定する（RFC 4180）。
 * 依存を増やさないのは `import-postal-codes.ts` と同じ理由。
 */

export type CsvRecord = Record<string, string>

/** CSV 文字列を行×列に切り分ける。空行は落とす。 */
export const parseCsv = (text: string): string[][] => {
  // BOM は先頭の1文字。残したまま見出しと比べると、1列目だけ一致しなくなる
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  const endRow = () => {
    row.push(field)
    field = ""
    // 末尾の改行で空の1列だけの行ができる。データのない行として扱わない
    if (!(row.length === 1 && row[0] === "")) rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (quoted) {
      if (char !== '"') {
        field += char
        continue
      }
      // 引用符の中の "" は引用符そのもの。それ以外の " は引用の終わり
      if (source[i + 1] === '"') {
        field += '"'
        i++
        continue
      }
      quoted = false
      continue
    }

    // 引用が始まるのは列の先頭だけ。途中の " はそのままの文字とみなす
    if (char === '"' && field === "") {
      quoted = true
      continue
    }
    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (char === "\n") {
      endRow()
      continue
    }
    // CRLF の CR は捨てる。引用符の中の改行はここへ来ない
    if (char === "\r") continue

    field += char
  }

  // 最終行に改行がない場合
  if (field !== "" || row.length > 0) endRow()

  return rows
}

/**
 * 先頭行を見出しとして、列名をキーにしたレコードへ変換する。
 *
 * 見出しが想定と違えばそこで止める。列がずれたまま取り込むと、
 * 別の列の値が入った状態で保存され、あとから気づけない。
 */
export const toRecords = (rows: string[][], header: readonly string[]): CsvRecord[] => {
  const [actual, ...body] = rows
  if (!actual) throw new Error("CSV が空です。")

  if (actual.length !== header.length || header.some((name, i) => actual[i]?.trim() !== name)) {
    throw new Error(
      `見出しが一致しません。\n  期待: ${header.join(",")}\n  実際: ${actual.join(",")}`,
    )
  }

  return body.map((cells, index) => {
    if (cells.length !== header.length) {
      throw new Error(
        `${index + 2} 行目の列数が ${cells.length} です。${header.length} 列必要です。`,
      )
    }
    return Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""]))
  })
}
