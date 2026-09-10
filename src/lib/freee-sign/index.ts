import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { freeeSignTokens } from "@/db/schema"
import { now, secondsFromNow } from "@/lib/datetime"
import { type FreeeSignDocumentStatus, isDocumentStatus } from "./document-status"

/**
 * freeeサイン（電子契約）との連携（05_外部連携仕様.md 3）。
 *
 * Webhook は使わず、こちらから呼ぶだけにする。freeeサインにサンドボックスが無く、
 * Webhook の送信先はテナント単位の設定なので、検証環境の操作が本番へ届く事故を
 * 防げないため（3.1）。
 *
 * **検証環境と本番環境は同じテナントを共有し、契約書の置き場をフォルダで分ける**（3.12）。
 * `folder_id` は文書作成の必須項目なので、環境ごとに別のフォルダIDを設定する。
 * 分離はこのIDだけが担保するため、設定を取り違えると検証環境の契約書が
 * 本番のフォルダに混ざる。
 *
 * **認証は OAuth 2.0 の認可コードフロー**（3.2）。freeeサインが発行できるのは
 * OAuth 2.0 クライアントだけで、サーバー間だけで完結する付与方式が無い
 * （`/oauth/token` の grant_type は authorization_code と refresh_token の2つだけ）。
 * 管理者が一度ブラウザで認可し、以後はリフレッシュトークンで更新し続ける。
 */

/** 動作モード。未設定なら連携そのものを使わせない */
export type FreeeSignMode = "live" | "mock" | "unconfigured"

/**
 * `live` と `mock` 以外はすべて未設定として扱う。
 * 既定を `live` にすると、設定を忘れた環境が本番テナントへ実際に送ってしまう。
 */
export const freeeSignMode = (): FreeeSignMode => {
  const mode = process.env.FREEE_SIGN_MODE
  if (mode === "live") return "live"
  if (mode === "mock") return "mock"
  return "unconfigured"
}

/** live で足りない設定の名前。空なら接続できる */
export const missingSettings = () =>
  [
    "FREEE_SIGN_BASE_URL",
    "FREEE_SIGN_CLIENT_ID",
    "FREEE_SIGN_CLIENT_SECRET",
    // 認可のたびに freeeサイン側の登録値と完全一致していないと弾かれる
    "FREEE_SIGN_REDIRECT_URI",
    "FREEE_SIGN_TEMPLATE_ID",
    "FREEE_SIGN_SENDER_ID",
    // 環境ごとの置き場。文書作成の必須項目でもある（3.6）
    "FREEE_SIGN_FOLDER_ID",
  ].filter((name) => !process.env[name])

const setting = (name: string) => {
  const value = process.env[name]
  if (!value) throw new FreeeSignError(`${name} が設定されていません。`)
  return value
}

export class FreeeSignError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "FreeeSignError"
  }
}

/** 認可が済んでいないときのエラー。画面で接続を促すために型で見分ける */
export class FreeeSignNotAuthorizedError extends FreeeSignError {
  constructor(message = "freeeサインと接続されていません。設定画面から接続してください。") {
    super(message)
    this.name = "FreeeSignNotAuthorizedError"
  }
}

// ---------------------------------------------------------------------------
// 認可（管理者が一度だけブラウザで行う）
// ---------------------------------------------------------------------------

/**
 * 認可画面のURL（3.2）。
 *
 * `redirect_uri` は freeeサインの「OAuth 2.0 API クライアント設定」に登録した値と
 * 完全に一致していなければならない。環境ごとに違うため設定で持つ。
 *
 * `state` は freeeサインのパラメータ定義に無い。返ってくる前提には**しない**。
 * 返ってきたときだけ突き合わせ、無い場合はクッキー側の照合だけで判断する。
 */
export const authorizeUrl = (state: string) => {
  const url = new URL(`${setting("FREEE_SIGN_BASE_URL")}/oauth/authorize`)
  url.searchParams.set("client_id", setting("FREEE_SIGN_CLIENT_ID"))
  url.searchParams.set("redirect_uri", setting("FREEE_SIGN_REDIRECT_URI"))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "all")
  url.searchParams.set("state", state)
  return url.toString()
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
}

/** `/oauth/token` は x-www-form-urlencoded しか受け付けない（JSON だと 400） */
const requestToken = async (params: Record<string, string>): Promise<TokenResponse> => {
  const response = await fetch(`${setting("FREEE_SIGN_BASE_URL")}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...params,
      client_id: setting("FREEE_SIGN_CLIENT_ID"),
      client_secret: setting("FREEE_SIGN_CLIENT_SECRET"),
    }),
  })
  if (!response.ok) {
    throw new FreeeSignError(
      `freeeサインのトークン取得に失敗しました。（${response.status}）`,
      response.status,
    )
  }
  return (await response.json()) as TokenResponse
}

/** 期限ぴったりまで使うと往復の間に切れるので、1分手前で切り上げる */
const expiryOf = (expiresIn: number) => secondsFromNow(Math.max(expiresIn - 60, 60))

/**
 * 認可コードをトークンに交換して保管する（3.2）。
 * 管理者が接続操作をしたときに1度だけ通る。
 */
export const completeAuthorization = async (
  code: string,
  actor: { id: number; displayName: string },
) => {
  const token = await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: setting("FREEE_SIGN_REDIRECT_URI"),
  })

  const at = now()
  await db
    .insert(freeeSignTokens)
    .values({
      singleton: "x",
      accessToken: token.access_token,
      accessTokenExpiresAt: expiryOf(token.expires_in),
      refreshToken: token.refresh_token,
      authorizedBy: actor.id,
      authorizedByName: actor.displayName,
      authorizedAt: at,
      createdAt: at,
      updatedAt: at,
    })
    // 接続し直しは同じ行を上書きする。行は常に1つ
    .onDuplicateKeyUpdate({
      set: {
        accessToken: token.access_token,
        accessTokenExpiresAt: expiryOf(token.expires_in),
        refreshToken: token.refresh_token,
        authorizedBy: actor.id,
        authorizedByName: actor.displayName,
        authorizedAt: at,
        updatedAt: at,
      },
    })
}

/** 接続状態。設定画面に出す */
export const connectionStatus = async () => {
  const [row] = await db
    .select({
      authorizedByName: freeeSignTokens.authorizedByName,
      authorizedAt: freeeSignTokens.authorizedAt,
      updatedAt: freeeSignTokens.updatedAt,
    })
    .from(freeeSignTokens)
    .limit(1)
  return row ?? null
}

/** 接続を切る。トークンを捨てるだけで、freeeサイン側の文書には触れない */
export const disconnect = async () => {
  await db.delete(freeeSignTokens)
}

// ---------------------------------------------------------------------------
// アクセストークンの維持
// ---------------------------------------------------------------------------

/**
 * 使えるアクセストークンを返す。期限が近ければ更新する。
 *
 * **リフレッシュトークンは1回使うと新しいものに置き換わる。** 同時に2つのタスクが
 * 更新すると、片方が握っている値が無効になる。行ロックで直列化し、
 * ロックを取ってからもう一度期限を見て、待っている間に更新済みなら何もしない。
 * プロセス内にキャッシュしないのも同じ理由で、保管場所は常にDBの1行だけにする。
 */
const accessToken = async (): Promise<string> => {
  const [current] = await db
    .select({
      accessToken: freeeSignTokens.accessToken,
      expiresAt: freeeSignTokens.accessTokenExpiresAt,
    })
    .from(freeeSignTokens)
    .limit(1)
  if (!current) throw new FreeeSignNotAuthorizedError()
  if (current.expiresAt > now()) return current.accessToken

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({
        accessToken: freeeSignTokens.accessToken,
        expiresAt: freeeSignTokens.accessTokenExpiresAt,
        refreshToken: freeeSignTokens.refreshToken,
      })
      .from(freeeSignTokens)
      .for("update")
      .limit(1)
    if (!locked) throw new FreeeSignNotAuthorizedError()
    // 待っている間に別のタスクが更新していたら、そのまま使う
    if (locked.expiresAt > now()) return locked.accessToken

    const token = await requestToken({
      grant_type: "refresh_token",
      refresh_token: locked.refreshToken,
    })
    await tx
      .update(freeeSignTokens)
      .set({
        accessToken: token.access_token,
        accessTokenExpiresAt: expiryOf(token.expires_in),
        refreshToken: token.refresh_token,
        updatedAt: now(),
      })
      .where(eq(freeeSignTokens.singleton, "x"))
    return token.access_token
  })
}

// ---------------------------------------------------------------------------
// 呼び出し
// ---------------------------------------------------------------------------

/**
 * 事務員の操作中なので再試行はしない。画面にエラーを出して本人にやり直してもらう（3.13）。
 * トークンの期限は呼ぶ前に見ているため、401 はここでは扱わない。
 */
const call = async (path: string, body: unknown): Promise<unknown> => {
  const response = await fetch(`${setting("FREEE_SIGN_BASE_URL")}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new FreeeSignError(errorMessage(response.status), response.status)
  return response.json()
}

/** 状態の取得だけは GET。本文が無いので分けている */
const get = async (path: string): Promise<unknown> => {
  const response = await fetch(`${setting("FREEE_SIGN_BASE_URL")}${path}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${await accessToken()}`,
    },
    // 外部の最新状態を見に行くので、フレームワークのキャッシュに乗せない
    cache: "no-store",
  })
  if (!response.ok) throw new FreeeSignError(errorMessage(response.status), response.status)
  return response.json()
}

/** 3.6 のエラー表。原因が事務員の手元にあるものと、設定側にあるものを言い分ける */
const errorMessage = (status: number) => {
  if (status === 400) return "freeeサインにテンプレートが見つかりません。設定を確認してください。"
  if (status === 401) {
    return "freeeサインとの接続が切れています。設定画面から接続し直してください。"
  }
  if (status === 403) {
    return "freeeサインのフォルダを指定できませんでした。FREEE_SIGN_FOLDER_ID を確認してください。"
  }
  if (status === 422) {
    return "テンプレートのオーナー側の必須入力項目が埋まっていません。テンプレートの設計を確認してください。"
  }
  if (status === 429) return "freeeサインが混み合っています。しばらくおいて、もう一度お試しください。"
  if (status >= 500) return "freeeサインが応答しません。しばらくおいて、もう一度お試しください。"
  return `freeeサインの呼び出しに失敗しました。（${status}）`
}

// ---------------------------------------------------------------------------
// 契約書の送付
// ---------------------------------------------------------------------------

/**
 * テンプレートから文書を作り、相手方へ送る（3.6）。
 *
 * 契約書のPDFは本システムで作らない。freeeサインのテンプレートから生成する（3.5）。
 * 署名依頼メールも freeeサインから送られる。本システムからは送らない（5.8）。
 *
 * `items` は渡さない。会社名など送付時点で確定していない項目は署名者側へ置き、
 * クライアントが署名時に入力する設計のため（3.5）。オーナー側に必須項目を
 * 置いたテンプレートを使うと `422` になるので、その旨をエラーで伝える。
 */
export const sendContract = async ({ title, email }: { title: string; email: string }) => {
  const mode = freeeSignMode()
  if (mode === "unconfigured") {
    throw new FreeeSignError("freeeサイン連携が設定されていません。")
  }

  // クレデンシャルを置かないローカル用。本物を呼ばずに、
  // 送付済みとして扱える文書IDだけを返す。ステージングは live で動かす
  if (mode === "mock") return { documentId: Date.now(), mocked: true as const }

  const created = (await call("/v1/documents", {
    template_id: Number(setting("FREEE_SIGN_TEMPLATE_ID")),
    // 必須。環境ごとに別のフォルダを指定して、検証と本番の契約書を混ぜない（3.12）
    folder_id: Number(setting("FREEE_SIGN_FOLDER_ID")),
    document: { title },
  })) as { id?: number }

  const documentId = created.id
  if (typeof documentId !== "number") {
    throw new FreeeSignError("freeeサインが文書IDを返しませんでした。")
  }

  // 相手方は1人のテンプレートを前提とする。to は文書に設定された人数分ちょうど渡す（3.6）
  await call(`/v1/documents/${documentId}/confirmations`, {
    notification_type: "email",
    sender_id: Number(setting("FREEE_SIGN_SENDER_ID")),
    to: [{ email }],
  })

  return { documentId, mocked: false as const }
}

// ---------------------------------------------------------------------------
// 文書の状態
// ---------------------------------------------------------------------------

/**
 * 文書の状態を取り直す（3.11 手動同期）。
 *
 * 締結は本来ポーリング（3.9）で拾うが、それは未実装。いまは事務員の操作で
 * 1件ずつ取り直す。事務員が freeeサインの画面で締結を確認した直後に
 * 本システムを開いた場合の遅延も、これで埋まる。
 *
 * `timestamped` は締結済みPDFを取得できる状態かを表す（3.10）。
 * PDFの取得はまだ実装していないが、判断材料として一緒に返す。
 */
export const fetchDocument = async (documentId: number) => {
  const mode = freeeSignMode()
  if (mode === "unconfigured") {
    throw new FreeeSignError("freeeサイン連携が設定されていません。")
  }
  // モックは本物を呼ばない。締結しない状態を返し続ける
  if (mode === "mock") {
    return { status: "in_progress" as FreeeSignDocumentStatus, timestamped: false }
  }

  const body = (await get(`/v1/documents/${documentId}`)) as {
    status?: string
    timestamped?: boolean
  }
  if (!isDocumentStatus(body.status)) {
    throw new FreeeSignError("freeeサインが想定しない状態を返しました。")
  }
  return { status: body.status, timestamped: body.timestamped === true }
}

/**
 * 文書のPDFを取得する（3.10）。
 *
 * 締結済みかどうかに関わらず取得できる。**未署名でも中身は見られる**ため、
 * 送付直後の確認にも使う。ただし freeeサイン側でPDFを生成している最中はエラーになる。
 * 独自の再試行は持たない。呼び出し側が「まだ取れない」として扱い、次の機会に任せる。
 */
export const fetchDocumentPdf = async (documentId: number): Promise<Uint8Array> => {
  const mode = freeeSignMode()
  if (mode === "unconfigured") {
    throw new FreeeSignError("freeeサイン連携が設定されていません。")
  }
  if (mode === "mock") {
    throw new FreeeSignError("この環境（mock）では契約書のPDFを取得できません。")
  }

  const response = await fetch(`${setting("FREEE_SIGN_BASE_URL")}/v1/documents/${documentId}`, {
    headers: {
      accept: "application/pdf",
      authorization: `Bearer ${await accessToken()}`,
    },
    cache: "no-store",
  })
  if (!response.ok) {
    // 生成中は 4xx/5xx が返る。理由を伝えて、あとで取り直せるようにする
    throw new FreeeSignError(
      "freeeサインから契約書のPDFを取得できませんでした。生成中の可能性があります。時間をおいて、もう一度お試しください。",
      response.status,
    )
  }
  return new Uint8Array(await response.arrayBuffer())
}
