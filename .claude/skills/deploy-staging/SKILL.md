---
name: deploy-staging
description: 助成金管理システムをステージング（検証環境）へデプロイする。「検証環境へデプロイして」「ステージングに反映して」「デプロイして」「ECRへpushして」「切り戻して」「ロールバックして」と言われたときに使う。イメージのビルドと ECR への push、マイグレーションの適用、ECS の再デプロイ、確認、切り戻しまでを扱う。Deploy this app to the staging environment on AWS ECS/ECR.
---

# ステージングへのデプロイ

手元でイメージをビルドして ECR へ push し、ECS のステージングへ反映する。
CI/CD は未整備で手動運用。背景と踏み台経由の手順は
`docs/手順書/ECRへのイメージ登録とデプロイ.md` にある。

**本番環境は存在しない。** デプロイ先はステージングだけ。

| 項目 | 値 |
| --- | --- |
| AWSプロファイル | `grant`（024430211741 / ap-northeast-1） |
| ECR | `024430211741.dkr.ecr.ap-northeast-1.amazonaws.com/grant-management` |
| ECSクラスタ / サービス | `grant-management-staging` |
| アクセス先 | https://staging.grant-management.buzzmedia-app.com |

## 進め方

### 1. 現状を調べる（先に必ず）

デプロイ済みのコミットが分からないまま進めない。**差分にマイグレーションが
含まれるかどうかで手順が変わる。**

```bash
export AWS_PROFILE=grant
aws sts get-caller-identity --output text --query Arn
docker info --format '{{.ServerVersion}} {{.Architecture}}'

# いま latest が指しているコミット
aws ecr describe-images --repository-name grant-management \
  --query 'sort_by(imageDetails,&imagePushedAt)[*].{tags:join(`,`,imageTags||[`<none>`]),pushedAt:imagePushedAt}' \
  --output text | tail -12

aws ecs describe-services --cluster grant-management-staging \
  --services grant-management-staging \
  --query 'services[0].{desired:desiredCount,running:runningCount,taskDef:taskDefinition}'
aws rds describe-db-instances --db-instance-identifier grant-management-staging \
  --query 'DBInstances[0].DBInstanceStatus' --output text
```

デプロイ済みタグを `DEPLOYED` として差分を見る。

```bash
git log --oneline "$DEPLOYED"..HEAD
git diff --name-only "$DEPLOYED"..HEAD -- drizzle/
```

- `drizzle/` に差分があれば **マイグレーション用イメージも作って先に流す**
- 差分が無ければアプリのイメージだけでよい

**業務時間外（平日19:30〜翌9:30、土日）は ECS が 0 タスク、RDS も停止している。**
`desired:0` や RDS が `stopped` なら、先に起こす。RDS の起動には数分かかる。

```bash
aws rds start-db-instance --db-instance-identifier grant-management-staging
aws ecs update-service --cluster grant-management-staging \
  --service grant-management-staging --desired-count 1
```

### 2. ビルドして push

```bash
export AWS_PROFILE=grant
export REPO=024430211741.dkr.ecr.ap-northeast-1.amazonaws.com/grant-management
export TAG=$(git rev-parse --short HEAD)

aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin \
    024430211741.dkr.ecr.ap-northeast-1.amazonaws.com

docker build --platform linux/arm64 -t "${REPO}:${TAG}" .
docker tag "${REPO}:${TAG}" "${REPO}:latest"
docker push "${REPO}:${TAG}"
docker push "${REPO}:latest"
```

マイグレーションがあるときは、続けてもう1つ。

```bash
docker build --platform linux/arm64 --target migrate -t "${REPO}:migrate-${TAG}" .
docker tag "${REPO}:migrate-${TAG}" "${REPO}:migrate-latest"
docker push "${REPO}:migrate-${TAG}"
docker push "${REPO}:migrate-latest"
```

**`src/` を変えたときは定期ジョブのイメージも push する。**
契約書の締結ポーリング（`src/jobs/poll-contracts.ts`）がこのイメージを使い、
アプリと同じコードを `tsx` で実行する。押し忘れるとジョブだけ古いまま動き続ける。

```bash
docker build --platform linux/arm64 --target jobs -t "${REPO}:jobs-${TAG}" .
docker tag "${REPO}:jobs-${TAG}" "${REPO}:jobs-latest"
docker push "${REPO}:jobs-${TAG}"
docker push "${REPO}:jobs-latest"
```

- **`--platform linux/arm64` を省かない。** タスクは Graviton。省くと `exec format error`
- **`${REPO}:latest` と波かっこで囲む。** zsh は `$REPO:l` を小文字化のモディファイアとして
  解釈し、`grant-managementatest` へ push しようとして失敗する
- **タスク定義は `latest` / `migrate-latest` / `jobs-latest` を見る。** コミットのタグだけ push しても反映されない。
  ハッシュ付きのタグは切り戻し用に一緒に push する

### 3. マイグレーションを先に適用する

**アプリを入れ替える前に流す。** 新しいコードが参照するテーブルを先に作るため。
順番を逆にすると、テーブルが無い状態で新コードが動く。

```bash
TASK=$(aws ecs run-task \
  --cluster grant-management-staging \
  --task-definition grant-management-staging-migrate \
  --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0ae8b567cc98d4567,subnet-01bc49fb7015ea514],securityGroups=[sg-04a267cde159da5ef],assignPublicIp=DISABLED}' \
  --query 'tasks[0].taskArn' --output text)

aws ecs wait tasks-stopped --cluster grant-management-staging --tasks "$TASK"
aws ecs describe-tasks --cluster grant-management-staging --tasks "$TASK" \
  --query 'tasks[0].containers[0].{exitCode:exitCode,reason:reason}'
aws logs tail /ecs/grant-management-staging --log-stream-name-prefix migrate --since 10m
```

**exitCode が 0 以外なら止めて報告する。** アプリのデプロイへ進まない。
成功すると `マイグレーションを適用しました。` が出る。適用済みは飛ばされるので、
繰り返し実行してよい。

### 4. 再デプロイして待つ

```bash
aws ecs update-service --cluster grant-management-staging \
  --service grant-management-staging --force-new-deployment
aws ecs wait services-stable --cluster grant-management-staging \
  --services grant-management-staging
```

### 5. 確認する

**「push した」で終わりにしない。** 動いているイメージが今回のものか digest で確かめる。
`latest` は使い回しのタグなので、サービスの状態だけでは入れ替わったか分からない。

```bash
T=$(aws ecs list-tasks --cluster grant-management-staging \
  --service-name grant-management-staging --query 'taskArns[0]' --output text)
aws ecs describe-tasks --cluster grant-management-staging --tasks "$T" \
  --query 'tasks[0].{started:startedAt,digest:containers[0].imageDigest}'
aws ecr describe-images --repository-name grant-management --image-ids imageTag="$TAG" \
  --query 'imageDetails[0].imageDigest' --output text

aws logs tail /ecs/grant-management-staging --since 5m
curl -s -o /dev/null -w "%{http_code}\n" https://staging.grant-management.buzzmedia-app.com/login
```

`/login` が 200 になること。認証が要る画面は未ログインだと 307 で正常。

### 6. 報告する

デプロイしたコミット・イメージのdigest・タスクの状態・HTTPの応答を書く。
**マイグレーションを流したなら、どのファイルを適用したかも書く。**

## マイグレーションに含まれないもの

`drizzle/` のマイグレーションはテーブルを作るだけ。**初期データは別**で、
マイグレーション用イメージには CSV も取り込みスクリプトも入っていない。

| 対象 | 入口 | ステージングでの流し方 |
| --- | --- | --- |
| 初期システム管理者 | `npm run db:seed` | 踏み台経由（手順書のB） |
| カリキュラムマスタ | `npm run db:curriculum` | 踏み台経由（手順書のB） |

`npm run db:seed` と `npm run db:curriculum` は `--env-file=.env.local` を付けるため、
**そのまま実行するとローカルのDBにつながる。** ステージングへ入れるときは
ポートフォワードしたうえで `DATABASE_URL` を明示する。

これらは勝手に流さない。**必要そうなら、状況を伝えて指示を仰ぐ。**

## 定期ジョブ

契約書の締結を10分間隔で検知する（`05_外部連携仕様.md` 3.9）。
EventBridge Scheduler が ECS の単発タスクを起動する。
**業務時間内（平日9〜19時台）だけ回る。** 時間外は RDS が停止しているため。

スケジュールは `freee_sign_enabled = true` のときだけ作られる。

```bash
aws scheduler get-schedule --name grant-management-staging-poll-contracts \
  --query '{state:State,cron:ScheduleExpression}'
aws logs tail /ecs/grant-management-staging --log-stream-name-prefix poll --since 30m
```

手で1回流すこともできる。

```bash
aws ecs run-task --cluster grant-management-staging \
  --task-definition grant-management-staging-poll-contracts --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0ae8b567cc98d4567,subnet-01bc49fb7015ea514],securityGroups=[sg-04a267cde159da5ef],assignPublicIp=DISABLED}'
```

## 切り戻し

前のタグを `latest` に付け替えて再デプロイする。

```bash
export PREV=<戻したいコミットの短縮ハッシュ>
docker pull "${REPO}:${PREV}"
docker tag "${REPO}:${PREV}" "${REPO}:latest"
docker push "${REPO}:latest"
aws ecs update-service --cluster grant-management-staging \
  --service grant-management-staging --force-new-deployment
```

**マイグレーションは戻らない。** down は用意していない。追加系の変更であれば
旧コードは新しい列やテーブルを参照しないのでそのまま動くが、
列の削除や型変更を含む場合は旧コードが壊れる。切り戻す前に `drizzle/` の差分を読む。

デプロイに失敗すると ECS のサーキットブレーカーが前のタスク定義へ戻すが、
`latest` は壊れたイメージを指したままになる。上の手順で明示的に戻す。

## つまずきやすい点

| 症状 | 原因 |
| --- | --- |
| `exec format error` | `--platform linux/arm64` を付け忘れた |
| `no basic auth credentials` | ECR のログイントークンが切れた（12時間） |
| push しても内容が変わらない | `latest` を push していない |
| `grant-managementatest does not exist` | zsh の `:l` モディファイア。`${REPO}` で囲む |
| `CannotPullContainerError` | ECR にそのタグが無い。`describe-images` で確認する |
| ALB が 5xx | ヘルスチェック先は `/login`。DBに届かないと200を返さない |
| DBに接続できない | 業務時間外で RDS が停止している |
| ビルドが `Failed to collect page data` で落ちる | `src/db/client.ts` が読み込み時に `DATABASE_URL` を要求する。builder ステージにダミーがある |
