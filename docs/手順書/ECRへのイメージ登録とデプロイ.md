# ECR へのイメージ登録とデプロイ（手動）

コンテナイメージを手元でビルドし、ECR へ push してステージングへ反映するまでの手順です。
GitHub Actions による自動化（`03_技術選定.md` 5.6）は未整備で、当面は手動で行います。

対象はステージング環境のみです。本番環境はドメインが未確定のためまだ作っていません。

| 項目 | 値 |
| --- | --- |
| AWSアカウント | 024430211741（プロファイル `grant`） |
| リージョン | ap-northeast-1 |
| ECR | `024430211741.dkr.ecr.ap-northeast-1.amazonaws.com/grant-management` |
| ECSクラスタ / サービス | `grant-management-staging` |
| アクセス先 | http://grant-management-staging-2044214452.ap-northeast-1.elb.amazonaws.com |

---

## 0. 先に用意するもの

**この2つはまだリポジトリにありません。** 初回だけ作成してコミットしてください。

### 0-1. `next.config.ts` に `output` を足す

standalone 出力にしないと、実行に必要なファイルだけを取り出せず、
イメージに `node_modules` 全体を入れることになります。

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  serverExternalPackages: ["@node-rs/argon2", "mysql2"],
  poweredByHeader: false,
}
```

`npm run build` は `NEXT_DIST_DIR=.next-build` を指定するため、
出力先は `.next-build/standalone` になります。

### 0-2. `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# @node-rs/argon2 はネイティブモジュールなので、実行環境と同じ Linux の中で
# npm ci を通す。ホスト（macOS）の node_modules を持ち込むと動かない。
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
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
# 静的ファイルは別なので distDir と同じ位置へ置く。
COPY --from=builder /app/.next-build/standalone ./
COPY --from=builder /app/.next-build/static ./.next-build/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

`public/` は現時点で存在しないため COPY していません。作った場合は
`COPY --from=builder /app/public ./public` を足してください。

### 0-3. `.dockerignore`

```
node_modules
.next
.next-build
.git
.env
.env.local
docs
infra
*.log
```

---

## 1. ECR にログイン

```bash
export AWS_PROFILE=grant

aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin \
    024430211741.dkr.ecr.ap-northeast-1.amazonaws.com
```

トークンの有効期限は12時間です。切れたら同じコマンドを流し直します。

## 2. ビルド

**ECS のタスクは X86_64 です。** Apple Silicon の Mac では
`--platform linux/amd64` を付けないと、起動時に `exec format error` で落ちます。
エミュレーションで動くため、初回は10〜20分かかることがあります。

```bash
TAG=$(git rev-parse --short HEAD)
REPO=024430211741.dkr.ecr.ap-northeast-1.amazonaws.com/grant-management

docker build --platform linux/amd64 -t "$REPO:$TAG" .
```

> ビルド時間が問題になるなら、ECS を ARM64 に変えるとエミュレーションが不要になり、
> Fargate の料金も約2割下がります。`infra/modules/compute/main.tf` の
> `runtime_platform.cpu_architecture` を `ARM64` にして apply し、
> 上の `--platform` を `linux/arm64` に読み替えます。RDS はすでに Graviton（t4g）です。

## 3. push

タスク定義は `:latest` を参照しています。**`latest` を push しないと反映されません。**
戻せるように、コミットのハッシュを付けたタグも一緒に push します。

```bash
docker tag "$REPO:$TAG" "$REPO:latest"
docker push "$REPO:$TAG"
docker push "$REPO:latest"
```

登録されたか確認します。

```bash
aws ecr describe-images --repository-name grant-management \
  --query 'sort_by(imageDetails,&imagePushedAt)[-5:].{tags:imageTags,pushedAt:imagePushedAt,bytes:imageSizeInBytes}' \
  --output table
```

古いイメージは ECR のライフサイクルポリシーが片付けます
（タグなしは1日、それ以外は直近20世代）。

## 4. デプロイ

### 初回だけ

タスク数が 0 のままなので、1 に上げます。

```bash
# infra/environments/staging/terraform.tfvars の desired_count を 1 にしてから
terraform -chdir=infra/environments/staging apply
```

この値は起動スケジュールが毎朝設定するタスク数にもなります。

### 2回目以降

タグが同じ `latest` のままなので、Terraform では変化を検知できません。
サービスに再デプロイを指示します。

```bash
aws ecs update-service \
  --cluster grant-management-staging \
  --service grant-management-staging \
  --force-new-deployment
```

**業務時間外はタスク数が 0 です。** 平日 19:30 以降と土日に push しても、
翌営業日の 9:30 まで反映されません。すぐ確認したいときは手動で上げます。

```bash
aws ecs update-service --cluster grant-management-staging \
  --service grant-management-staging --desired-count 1
```

RDS も 19:35 に停止しているので、必要なら先に起こします（起動に数分かかります）。

```bash
aws rds start-db-instance --db-instance-identifier grant-management-staging
```

## 5. 確認

デプロイが落ち着くまで待ちます。

```bash
aws ecs wait services-stable \
  --cluster grant-management-staging \
  --services grant-management-staging
```

状態と、動いているタスク定義を見ます。

```bash
aws ecs describe-services \
  --cluster grant-management-staging \
  --services grant-management-staging \
  --query 'services[0].{desired:desiredCount,running:runningCount,taskDef:taskDefinition}'
```

ログはここに出ます。

```bash
aws logs tail /ecs/grant-management-staging --follow
```

ALB 越しに応答するか確認します。

```bash
curl -I http://grant-management-staging-2044214452.ap-northeast-1.elb.amazonaws.com/login
```

## 6. 切り戻し

前のタグを `latest` に付け替えて、再デプロイします。

```bash
PREV=<戻したいコミットの短縮ハッシュ>
docker pull "$REPO:$PREV"
docker tag "$REPO:$PREV" "$REPO:latest"
docker push "$REPO:latest"

aws ecs update-service --cluster grant-management-staging \
  --service grant-management-staging --force-new-deployment
```

デプロイに失敗した場合は、ECS のデプロイサーキットブレーカーが
自動で前のタスク定義へ戻します。ただしタグが同じ `latest` のままなので、
壊れたイメージを指したままになります。上の手順で明示的に戻してください。

---

## マイグレーションについて（未整備）

**現時点では、ステージングの DB へマイグレーションを流す手段がありません。**
RDS はプライベートサブネットにあり、手元から直接つなげません。

`npm run db:migrate` は `drizzle-kit` に依存しますが、これは devDependency で、
standalone のイメージには入りません。次のいずれかが要ります。

- Dockerfile に migrate 用のステージを足し、`aws ecs run-task` で単発実行する
- `drizzle-orm/mysql2/migrator` を呼ぶ小さなスクリプトを本体に同梱し、
  タスク定義の command を上書きして実行する（drizzle-orm は本番依存なので追加が要らない）

後者のほうが軽く、`drizzle/` 配下の SQL と journal だけで動きます。
どちらにするか決めてから、この節を書き足してください。

---

## つまずきやすい点

| 症状 | 原因 |
| --- | --- |
| タスクが起動せず `exec format error` | `--platform linux/amd64` を付け忘れた |
| `no basic auth credentials` | ECR のログイントークンが切れた（12時間） |
| push しても内容が変わらない | `latest` を push していない。タスク定義は `:latest` を見る |
| タスクは動くが ALB が 5xx | ヘルスチェック先は `/login`。DB に届かないと 200 を返さない |
| DB に接続できない | 業務時間外で RDS が停止している |
| `CannotPullContainerError` | ECR にそのタグが無い。`describe-images` で確認する |

ログイン画面までは DB を使うため、RDS が停止しているとヘルスチェックが通りません。
確認は RDS を起こしてから行ってください。
