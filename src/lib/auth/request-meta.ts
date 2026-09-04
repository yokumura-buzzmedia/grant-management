import { isIP } from "node:net"

const ipv4ToBytes = (ip: string) => Buffer.from(ip.split(".").map(Number))

const ipv6ToBytes = (ip: string): Buffer | null => {
  // 末尾が IPv4 形式（::ffff:192.0.2.1）の場合は 16 進表記へ直してから解釈する
  let text = ip
  const embedded = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (embedded?.[1]) {
    const b = ipv4ToBytes(embedded[1])
    const hi = ((b[0]! << 8) | b[1]!).toString(16)
    const lo = ((b[2]! << 8) | b[3]!).toString(16)
    text = `${ip.slice(0, ip.length - embedded[1].length)}${hi}:${lo}`
  }

  const compressed = text.includes("::")
  const [head = "", tail = ""] = text.split("::")
  const headParts = head ? head.split(":") : []
  const tailParts = tail ? tail.split(":") : []
  const fill = 8 - headParts.length - tailParts.length
  if (compressed ? fill < 0 : fill !== 0) return null

  const parts = [...headParts, ...Array<string>(compressed ? fill : 0).fill("0"), ...tailParts]
  const buffer = Buffer.alloc(16)
  parts.forEach((part, i) => buffer.writeUInt16BE(parseInt(part, 16), i * 2))
  return buffer
}

/** sessions.ip_address は varbinary(16)。IPv4 は4バイト、IPv6 は16バイトで保存する。 */
export const parseIpAddress = (value: string | null | undefined): Buffer | null => {
  const first = value?.split(",")[0]?.trim()
  if (!first) return null
  const version = isIP(first)
  if (version === 4) return ipv4ToBytes(first)
  if (version === 6) return ipv6ToBytes(first)
  return null
}
