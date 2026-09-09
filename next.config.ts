import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /**
   * 実行に必要なファイルだけを .next-build/standalone に出す。
   * コンテナイメージに node_modules 全体を入れずに済む。
   * 詳細は docs/手順書/ECRへのイメージ登録とデプロイ.md。
   */
  output: "standalone",
  /**
   * 出力先。`npm run build` は .next-build を使う。
   * 開発サーバーを動かしたままビルドすると .next が上書きされ、
   * 開いているページが参照するチャンクが 404 になるため分けている。
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Argon2 はネイティブモジュールのため、サーバー側でバンドルせず require させる
  serverExternalPackages: ["@node-rs/argon2", "mysql2"],
  // 本番でバージョン情報を返さない（03_技術選定.md 5.4）
  poweredByHeader: false,
}

export default nextConfig
