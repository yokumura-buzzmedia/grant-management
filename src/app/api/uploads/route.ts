import { MAX_FILE_SIZE } from "@/db/schema"
import { isAllowedContentType, isExpired, verifySignature } from "@/lib/storage"
import { getObject, putObject } from "@/lib/storage/local"

/**
 * 開発用のファイル保管の受け口（03_技術選定.md 4.6）。本番は S3 が担う。
 *
 * 認可はセッションではなく署名で行う。S3 の署名付きURLと同じ考え方で、
 * URL を発行する側（サーバーアクション）が権限を検証している。
 */

const unauthorized = () => new Response("署名が正しくありません。", { status: 403 })

const check = (parts: string[], signature: string | null, expires: string | null) => {
  if (!signature || !expires) return false
  if (isExpired(expires)) return false
  return verifySignature([...parts, expires], signature)
}

export async function PUT(request: Request) {
  const params = new URL(request.url).searchParams
  const key = params.get("key")
  const contentType = params.get("type")
  if (!key || !contentType) return new Response("パラメータが足りません。", { status: 400 })
  if (!check(["put", key, contentType], params.get("signature"), params.get("expires"))) {
    return unauthorized()
  }
  if (!isAllowedContentType(contentType)) {
    return new Response("この形式のファイルは扱えません。", { status: 415 })
  }

  const body = Buffer.from(await request.arrayBuffer())
  // 署名は種別と鍵しか縛れない。大きさは受け取ってから確認する
  if (body.byteLength === 0 || body.byteLength > MAX_FILE_SIZE) {
    return new Response("ファイルの大きさが範囲外です。", { status: 413 })
  }

  await putObject(key, body)
  return new Response(null, { status: 204 })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const mode = params.get("mode")
  const key = params.get("key")
  const filename = params.get("filename")
  const contentType = params.get("type")
  if (!key || !filename || !contentType) {
    return new Response("パラメータが足りません。", { status: 400 })
  }
  if (mode !== "download" && mode !== "view") {
    return new Response("取り出し方が正しくありません。", { status: 400 })
  }
  if (
    !check([mode, key, filename, contentType], params.get("signature"), params.get("expires"))
  ) {
    return unauthorized()
  }
  if (!isAllowedContentType(contentType)) {
    return new Response("この形式のファイルは扱えません。", { status: 415 })
  }

  let body: Buffer
  try {
    body = await getObject(key)
  } catch {
    return new Response("ファイルが見つかりません。", { status: 404 })
  }

  const disposition = mode === "view" ? "inline" : "attachment"
  return new Response(new Uint8Array(body), {
    headers: {
      // 保管名ではなく元のファイル名で渡す
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "content-type": contentType,
      /*
       * 中身は検査していない。HTML を PDF と偽って送られても、
       * nosniff があればブラウザは宣言した種別としてしか扱わない
       */
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  })
}
