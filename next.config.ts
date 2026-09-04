import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Argon2 はネイティブモジュールのため、サーバー側でバンドルせず require させる
  serverExternalPackages: ["@node-rs/argon2", "mysql2"],
  // 本番でバージョン情報を返さない（03_技術選定.md 5.4）
  poweredByHeader: false,
}

export default nextConfig
