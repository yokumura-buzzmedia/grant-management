import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * アップロードファイルの保管（03_技術選定.md 4.6）。
 *
 * 1ファイル最大50MB（5.2）は Server Action のボディ上限を大きく超えるため、
 * アプリケーションサーバーを経由させない。
 *
 *   1. サーバーが権限を検証し、署名付きの PUT URL を発行する
 *   2. ブラウザがその URL へ直接アップロードする
 *   3. 完了後、サーバーへファイルキーを登録する
 *
 * 本番は S3 を使う。ここにあるのは開発用のローカル保管ドライバで、
 * 同じ3段構えのまま保存先だけをローカルの .uploads/ に差し替えたもの。
 * S3 ドライバを足すときは、この 3 つの関数だけを差し替えればよい。
 */

/** PDF / JPEG / PNG のみ（5.2） */
export const ALLOWED_CONTENT_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const

export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES

export const isAllowedContentType = (value: string): value is AllowedContentType =>
  value in ALLOWED_CONTENT_TYPES

/** 署名の有効期限。押してから選び直す時間を見て長めに取る */
const UPLOAD_TTL_MS = 15 * 60 * 1000
const DOWNLOAD_TTL_MS = 10 * 60 * 1000

const secret = () => {
  const value = process.env.FILE_STORAGE_SECRET
  // 既定値を持たせない。鍵がないまま動くと、誰でも任意のキーへ書ける
  if (!value) throw new Error("FILE_STORAGE_SECRET が設定されていません。")
  return value
}

const sign = (parts: string[]) =>
  createHmac("sha256", secret()).update(parts.join("\n")).digest("hex")

/** 署名の比較は長さと内容の両方を見る。timingSafeEqual は長さが違うと例外を投げる */
export const verifySignature = (parts: string[], signature: string) => {
  const expected = Buffer.from(sign(parts))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const url = (path: string, params: Record<string, string>) =>
  `${path}?${new URLSearchParams(params).toString()}`

/** ブラウザが直接 PUT する先。有効期限つきの署名を含む */
export const createUploadUrl = (key: string, contentType: string) => {
  const expires = String(Date.now() + UPLOAD_TTL_MS)
  return url("/api/uploads", {
    key,
    type: contentType,
    expires,
    signature: sign(["put", key, contentType, expires]),
  })
}

/**
 * 取り出し方は署名に含める。
 * 含めないと、保存させるつもりで出したURLを画面内表示へ書き換えられる。
 */
export type ReadMode = "download" | "view"

const createReadUrl = (
  mode: ReadMode,
  key: string,
  filename: string,
  contentType: string,
) => {
  const expires = String(Date.now() + DOWNLOAD_TTL_MS)
  return url("/api/uploads", {
    mode,
    key,
    filename,
    type: contentType,
    expires,
    signature: sign([mode, key, filename, contentType, expires]),
  })
}

/** 保存用。ファイル名は保管名ではなく元の名前で返す */
export const createDownloadUrl = (key: string, filename: string, contentType: string) =>
  createReadUrl("download", key, filename, contentType)

/** 画面内で開く用。PDF と画像だけを許しているので、そのままの種別で返す */
export const createPreviewUrl = (key: string, filename: string, contentType: string) =>
  createReadUrl("view", key, filename, contentType)

export const isExpired = (expires: string) => {
  const at = Number(expires)
  return !Number.isFinite(at) || at < Date.now()
}
