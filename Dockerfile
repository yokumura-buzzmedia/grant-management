# syntax=docker/dockerfile:1

# ECS Fargate は ARM64（Graviton）で動かす。開発機も Apple Silicon なので
# エミュレーションなしでビルドできる。詳細は
# docs/手順書/ECRへのイメージ登録とデプロイ.md。

# @node-rs/argon2 はネイティブモジュールなので、実行環境と同じ Linux の中で
# npm ci を通す。ホスト（macOS）の node_modules を持ち込むと動かない。
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# src/db/client.ts はモジュール読み込み時に DATABASE_URL を要求する。
# Next.js のページ解析でそこを通るため、ビルドを通すだけのダミーを置く。
# 接続はしない。この ENV は builder ステージ限定で、runner には引き継がれない。
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# standalone には server.js と、実行に必要な node_modules だけが入る。
# 静的ファイルは含まれないので、distDir と同じ位置へ別途置く。
COPY --from=builder /app/.next-build/standalone ./
COPY --from=builder /app/.next-build/static ./.next-build/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
