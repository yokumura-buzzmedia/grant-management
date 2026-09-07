"use server"

import { eq } from "drizzle-orm"
import { db } from "@/db/client"
import { postalCodes } from "@/db/schema"
import { requireActiveUser } from "@/lib/auth/guards"

/**
 * 郵便番号から住所を引く（01_要件定義.md 5.3）。
 *
 * 外部APIには依存せず、月次で取り込んだ postal_codes を参照する
 * （05_外部連携仕様.md 5）。取得できない場合は利用者が手入力する。
 */
export type PostalCodeLookup =
  | { status: "found"; address: string }
  /** 同じ郵便番号に町域が複数ある。市区町村までを返し、続きは利用者に入力させる */
  | { status: "ambiguous"; address: string }
  | { status: "notFound" }

export async function lookupPostalCodeAction(code: string): Promise<PostalCodeLookup> {
  await requireActiveUser()
  if (!/^\d{7}$/.test(code)) return { status: "notFound" }

  const rows = await db
    .select({
      prefecture: postalCodes.prefecture,
      city: postalCodes.city,
      town: postalCodes.town,
    })
    .from(postalCodes)
    .where(eq(postalCodes.postalCode, code))
    .limit(20)

  const first = rows[0]
  if (!first) return { status: "notFound" }

  if (rows.length > 1) {
    return { status: "ambiguous", address: `${first.prefecture}${first.city}` }
  }
  return { status: "found", address: `${first.prefecture}${first.city}${first.town ?? ""}` }
}
