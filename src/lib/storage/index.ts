import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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
 * 本番は S3、ローカルは S3 互換の MinIO（docker-compose.yml）。
 * 同じ SDK と同じ署名付きURLで動かし、差し替わるのは接続先だけにする。
 * 保管先ごとに実装を分けると、本番でだけ通る経路が生まれて検証できなくなる。
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

/** 署名の有効期限（秒）。押してから選び直す時間を見て、アップロードは長めに取る */
const UPLOAD_TTL = 15 * 60
const READ_TTL = 10 * 60

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} が設定されていません。`)
  return value
}

let cached: S3Client | undefined

/**
 * 接続はモジュールの読み込み時ではなく、最初に使うときに作る。
 * ビルド時に環境変数を要求しないため。
 */
const client = () =>
  (cached ??= new S3Client({
    region: process.env.S3_REGION ?? "ap-northeast-1",
    // 本番（S3）では未設定。MinIO はエンドポイントとパス形式の指定が要る
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    /*
     * 鍵を環境変数で渡すのはローカルだけ。
     * 本番は ECS のタスクロールから取るため、未設定なら SDK の既定の解決に任せる
     */
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  }))

/** 保管名ではなく元のファイル名で渡す。日本語を含むので RFC 5987 の書式にする */
const disposition = (kind: "attachment" | "inline", filename: string) =>
  `${kind}; filename*=UTF-8''${encodeURIComponent(filename)}`

/** ブラウザが直接 PUT する先。ContentType も署名に含まれるので、送信時も同じ値を付ける */
export const createUploadUrl = (key: string, contentType: string) =>
  getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: required("S3_BUCKET"), Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_TTL },
  )

const createReadUrl = (
  key: string,
  filename: string,
  contentType: string,
  kind: "attachment" | "inline",
) =>
  getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: required("S3_BUCKET"),
      Key: key,
      ResponseContentDisposition: disposition(kind, filename),
      // 中身のバイト列は検査していない。種別を上書きして返し、宣言した種別としてだけ扱わせる
      ResponseContentType: contentType,
      ResponseCacheControl: "no-store",
    }),
    { expiresIn: READ_TTL },
  )

/** 保存用 */
export const createDownloadUrl = (key: string, filename: string, contentType: string) =>
  createReadUrl(key, filename, contentType, "attachment")

/** 画面内で開く用。PDF と画像だけを許しているので、そのままの種別で返す */
export const createPreviewUrl = (key: string, filename: string, contentType: string) =>
  createReadUrl(key, filename, contentType, "inline")

/**
 * サーバーが取得したバイト列をそのまま置く。
 *
 * 利用者のアップロードは署名付きURLでブラウザから直接送らせるが（4.6）、
 * 外部サービスから取ってきたファイルは手元にあるので、ここから置く。
 * 締結済みの契約書PDFがこれにあたる（05_外部連携仕様.md 3.10）。
 */
export const putObject = async (key: string, body: Uint8Array, contentType: string) => {
  await client().send(
    new PutObjectCommand({
      Bucket: required("S3_BUCKET"),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

/** 差し替え・削除時に実体を消す（履歴を保持しない方針・5.2） */
export const deleteObject = async (key: string) => {
  await client().send(new DeleteObjectCommand({ Bucket: required("S3_BUCKET"), Key: key }))
}
