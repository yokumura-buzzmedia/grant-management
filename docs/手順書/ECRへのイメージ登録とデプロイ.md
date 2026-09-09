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

## 0. 前提

必要なファイルはリポジトリに入っています。用意するのは手元の環境だけです。

- Docker Desktop が起動していること
- AWS プロファイル `grant` が使えること（`aws sts get-caller-identity --profile grant`）

| ファイル | 役割 |
| --- | --- |
| `Dockerfile` | 3段構成。`npm ci` はコンテナの中で通す |
| `.dockerignore` | `node_modules` と `.next-build` を送らない |
| `next.config.ts` | `output: "standalone"` |

`npm run build` は `NEXT_DIST_DIR=.next-build` を指定するため、
standalone の出力先は `.next-build/standalone` です。Dockerfile はそこを見ています。

`public/` は現時点で存在しないため COPY していません。作った場合は
Dockerfile に `COPY --from=builder /app/public ./public` を足してください。

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

**ECS のタスクは ARM64（Graviton）です。** Apple Silicon の Mac ならエミュレーションなしで
ビルドできます。Intel Mac や x86 の Linux から実行する場合はエミュレーションになり、
10〜20分かかることがあります。

```bash
TAG=$(git rev-parse --short HEAD)
REPO=024430211741.dkr.ecr.ap-northeast-1.amazonaws.com/grant-management

docker build --platform linux/arm64 -t "$REPO:$TAG" .
```

`--platform` は省略しないでください。省くとビルドした機械のアーキテクチャになり、
x86 の環境から push すると ECS 上で `exec format error` になります。

## 3. push

タスク定義は `:latest` を参照しています。**`latest` を push しないと反映されません。**
戻せるように、コミットのハッシュを付けたタグも一緒に push します。

```bash
docker tag "${REPO}:${TAG}" "${REPO}:latest"
docker push "${REPO}:${TAG}"
docker push "${REPO}:latest"
```

**`"$REPO:latest"` と書かないでください。** zsh は `$REPO:l` の `:l` を
小文字化のモディファイアとして解釈するため、`grant-managementatest` という
存在しないリポジトリへ push しようとして失敗します。`${REPO}` と波かっこで囲みます。

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

`terraform.tfvars` の `desired_count` は **起動スケジュールが毎朝設定する値**で、
サービスの現在のタスク数ではありません。サービスの `desired_count` は Terraform の
`ignore_changes` に入れてあるため、apply では変わりません。いま動かすには別途上げます。

```bash
aws ecs update-service --cluster grant-management-staging \
  --service grant-management-staging --desired-count 1
```

### Terraform でタスク定義を変えたとき

環境変数やアーキテクチャなど、タスク定義に関わる変更を apply すると新しい
リビジョンが登録され、サービスもそこへ切り替わります。切り替わったか確認します。

```bash
aws ecs describe-services --cluster grant-management-staging \
  --services grant-management-staging \
  --query 'services[0].taskDefinition'
```

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

## マイグレーション

RDS はプライベートサブネットにあり、手元から直接つなげません。
手段は2つ用意しています。**通常は A、DB の中身を見たいときは B** です。

`npm run db:migrate` が使う `drizzle-kit` は devDependency で、
アプリのイメージには入りません。また `drizzle-orm` は Next.js のバンドルに
取り込まれるため、standalone の `node_modules` にも独立して存在しません。
そのため専用のイメージを分けています。

### A. ECS の単発タスクで流す（通常はこちら）

設計書 5.6 の3にあたります。常時動くものが増えず、後で CI へ移すときもそのまま使えます。

`Dockerfile` の `migrate` ステージを使います。中身は `node_modules` 一式と
`drizzle/`、`scripts/migrate.mjs` だけです。

```bash
export AWS_PROFILE=grant
TAG=$(git rev-parse --short HEAD)
REPO=024430211741.dkr.ecr.ap-northeast-1.amazonaws.com/grant-management

docker build --platform linux/arm64 --target migrate -t "$REPO:migrate-$TAG" .
docker tag "$REPO:migrate-$TAG" "$REPO:migrate-latest"
docker push "$REPO:migrate-$TAG"
docker push "$REPO:migrate-latest"
```

タスク定義は `migrate-latest` を見ています。単発タスクとして起動します。

```bash
TASK=$(aws ecs run-task \
  --cluster grant-management-staging \
  --task-definition grant-management-staging-migrate \
  --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0ae8b567cc98d4567,subnet-01bc49fb7015ea514],securityGroups=[sg-04a267cde159da5ef],assignPublicIp=DISABLED}' \
  --query 'tasks[0].taskArn' --output text)

aws ecs wait tasks-stopped --cluster grant-management-staging --tasks "$TASK"
```

終了コードを確認します。**0 以外なら失敗**です。

```bash
aws ecs describe-tasks --cluster grant-management-staging --tasks "$TASK" \
  --query 'tasks[0].containers[0].{exitCode:exitCode,reason:reason}'

aws logs tail /ecs/grant-management-staging --log-stream-name-prefix migrate --since 10m
```

成功すると `マイグレーションを適用しました。` が出ます。
適用済みのものは飛ばされるので、繰り返し実行しても問題ありません。

RDS が停止している時間帯は接続に失敗します。先に起こしてください。

### B. 踏み台越しに手元から流す

`t4g.nano` の踏み台を SSM Session Manager 経由で使い、RDS へポートフォワードします。
手元の `drizzle-kit` がそのまま使えるので、**`npm run db:studio` で中身を見る、
調査用の SQL を投げる**といったこともできます。

初回だけ、Session Manager プラグインを入れます（管理者パスワードを聞かれます）。

```bash
brew install --cask session-manager-plugin
```

ポートフォワードを張ります。**このターミナルは開いたままにします。**

```bash
export AWS_PROFILE=grant
aws ssm start-session --target i-0bd4b445b198bf174 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["grant-management-staging.c9awqsog42gg.ap-northeast-1.rds.amazonaws.com"],"portNumber":["3306"],"localPortNumber":["13306"]}'
```

別のターミナルで、Secrets Manager からパスワードを取って流します。

```bash
export AWS_PROFILE=grant
PASS=$(aws secretsmanager get-secret-value \
  --secret-id grant-management-staging/database-url \
  --query SecretString --output text | sed -E 's#^mysql://[^:]+:([^@]+)@.*#\1#')

DATABASE_URL="mysql://grant_app:$PASS@127.0.0.1:13306/grant_management" \
  npx drizzle-kit migrate
```

`npm run db:migrate` ではなく `npx drizzle-kit migrate` を使います。
前者は `--env-file=.env.local` を付けるため、ローカルの DB につながってしまいます。

中身を見るときも同じ経路です。

```bash
DATABASE_URL="mysql://grant_app:$PASS@127.0.0.1:13306/grant_management" \
  npx drizzle-kit studio
```

踏み台は常時起動で月3USD程度です。しばらく使わないなら止められます。

```bash
aws ec2 stop-instances --instance-ids i-0bd4b445b198bf174
aws ec2 start-instances --instance-ids i-0bd4b445b198bf174
```

止めている間は SSM にも現れません。起動後、`PingStatus` が `Online` に
なるまで1分ほどかかります。

```bash
aws ssm describe-instance-information \
  --query 'InstanceInformationList[].{id:InstanceId,ping:PingStatus}' --output table
```

---

## つまずきやすい点

| 症状 | 原因 |
| --- | --- |
| タスクが起動せず `exec format error` | `--platform linux/arm64` を付け忘れた |
| ビルドが `Failed to collect page data` で落ちる | `src/db/client.ts` が読み込み時に `DATABASE_URL` を要求する。Dockerfile の builder ステージにダミーを置いてある |
| `no basic auth credentials` | ECR のログイントークンが切れた（12時間） |
| push しても内容が変わらない | `latest` を push していない。タスク定義は `:latest` を見る |
| タスクは動くが ALB が 5xx | ヘルスチェック先は `/login`。DB に届かないと 200 を返さない |
| DB に接続できない | 業務時間外で RDS が停止している |
| `CannotPullContainerError` | ECR にそのタグが無い。`describe-images` で確認する |
| `image Manifest does not contain descriptor matching platform 'linux/amd64'` | サービスが古いタスク定義（X86_64）を参照している。`describe-services` でリビジョンを確認する |
| `grant-managementatest does not exist` | zsh の `:l` モディファイア。`${REPO}:latest` と書く |

ログイン画面までは DB を使うため、RDS が停止しているとヘルスチェックが通りません。
確認は RDS を起こしてから行ってください。
