/**
 * 日時の扱い。
 * DB へはすべて UTC で保存し（mysql2 の timezone: "Z"）、表示時に JST へ変換する。
 */

/** 現在時刻。保存時に UTC へ変換される。 */
export const now = () => new Date()

/** 現在時刻から指定日数後。 */
export const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)

/** 秒単位の期限。外部トークンの有効期限が秒で返るため */
export const secondsFromNow = (seconds: number) => new Date(Date.now() + seconds * 1000)

const JST_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

/** UTC で保持している日時を JST の文字列にする。 */
export const formatJst = (date: Date) => JST_FORMAT.format(date)
