# インフラ

`docs/設計/03_技術選定.md` 5章の構成を Terraform で管理します。
環境差分は変数で吸収し、モジュールは環境間で共有します。

```
infra/
  modules/
    network/    VPC・サブネット・NAT・S3エンドポイント
    storage/    アップロードファイルの S3 バケット
    database/   RDS MySQL・パラメータグループ・接続文字列のシークレット
    registry/   ECR
    compute/    ALB・ECS Fargate・IAM ロール・ロググループ
    scheduler/  業務時間外の自動停止（EventBridge Scheduler）
    bastion/    SSM ポートフォワード用の踏み台
    dns/        ACM 証明書と Route 53 レコード
  environments/
    shared/     環境をまたいで共有するもの（ECR・ホストゾーン）
    staging/    ステージング
```

`shared` は ECR とホストゾーンを持ちます。どちらも本番とステージングの両方が
使うため、どちらかの環境の state に置くと、その環境を作り直したときに
もう一方が壊れます。

**本番環境はまだありません。** ドメインが決まっていないため、先にステージングだけを
立ち上げています。本番を作るときは `environments/staging` を複製し、
`name` と backend の `key` を変え、`db_instance_class` と `desired_count` を戻し、
`schedule_enabled = false` にします。

## ドメイン

`buzzmedia-app.com` は組織で使い回すため、**Organization の管理アカウント
（982227460789 / BUZZMEDIA）で登録**します。特定アプリのアカウントが
全社ドメインの持ち主になると、そのアカウントを整理するときに巻き込まれます。

そのうえで `grant-management.buzzmedia-app.com` を NS 委譲で
GrantManagement アカウント（024430211741）が受け取ります。委譲しておかないと、
ACM の証明書検証と SES の DKIM のたびに管理アカウント側での作業が発生します。

```
982227460789  buzzmedia-app.com
                └─ NS grant-management → 委譲
024430211741  grant-management.buzzmedia-app.com
                ├─ A  grant-management.buzzmedia-app.com          → 本番 ALB
                └─ A  staging.grant-management.buzzmedia-app.com  → ステージング ALB
```

委譲レコードは `shared` スタックが `aws.parent` プロバイダ経由で登録します。
他のアプリを足すときも同じ形でいけます。

## 前提

- Terraform 1.11 以上（S3 ネイティブロックを使うため）
- AWS プロファイル `grant`（`024430211741` へ AssumeRole する設定）

```bash
export AWS_PROFILE=grant
terraform -chdir=infra/environments/shared plan
terraform -chdir=infra/environments/staging plan
```

`shared` だけは2つのアカウントを触るため、プロバイダに profile を直接書いています
（`grant` と `buzzmedia`）。他のスタックは `AWS_PROFILE` に従います。

## state

`s3://grant-management-tfstate-024430211741` に置いています。
バージョニングと暗号化は有効です。排他制御は S3 のロックファイルで行うため、
DynamoDB テーブルは作っていません。

このバケットだけは Terraform では作れないため（鶏卵）、AWS CLI で作成しました。

`prod/terraform.tfstate` は、ステージングへ移行する前の残骸です。中身は
`staging/terraform.tfstate` と同じ時点のもので、参照されていません。

## 稼働時間

ステージングは平日の業務時間だけ動かします（5.5）。祝日は判定せず、土日のみ停止します。

| 時刻（JST・平日） | 動作 |
| --- | --- |
| 9:15 | RDS 起動 |
| 9:30 | ECS のタスク数を `desired_count` へ |
| 19:30 | ECS のタスク数を 0 |
| 19:35 | RDS 停止 |

RDS は起動に数分かかるため ECS より先に起こし、停止は逆順にします。
止めたいときは `schedule_enabled = false` にして apply します。

停止した RDS は7日後に AWS が自動起動します。平日に毎日起動と停止を繰り返すため
通常は問題になりませんが、長期休暇で1週間以上止める場合は起動したままになります。

## 決めたこと

- **NAT ゲートウェイは1台。** 1台あたり約45USD/月かかるため、冗長化より費用を優先しました。
  AZ 障害時はプライベート側の外向き通信が止まります。ECS タスク自体は2AZに分散します。
  freee サイン API への外向き通信があるため、NAT を無くすことはできません。
  スケジュールで止められないので、ステージングでも常時課金されます。
- **S3 はゲートウェイ型エンドポイント経由。** アップロードファイルの転送量が
  そのまま NAT のデータ処理料金になるのを避けます。エンドポイント自体は無料です。
- **RDS のパスワードは Terraform が生成し、組み立て済みの `DATABASE_URL` を
  Secrets Manager に置きます。** アプリが接続文字列1本を読む実装のためです。
  RDS 管理のシークレット（`manage_master_user_password`）はユーザー名とパスワードを
  別々に持つ形式なので、タスク定義から1変数として渡せません。
  パスワードは記号を含めません。URL エンコードが要る文字を最初から避けるためです。
- **RDS のマスターユーザー名は `grant_app`。** `grant` は MySQL の予約語で、
  RDS がマスターユーザー名として受け付けません。
- **照合順序はパラメータグループで明示。** `utf8mb4_ja_0900_as_cs` を使います。
  MySQL 8 の既定 `utf8mb4_0900_ai_ci` は濁点・半濁点を区別しません。
- **DB のサブネットグループとセキュリティグループは `create_before_destroy`。**
  名前を変えると作り直しになりますが、RDS インスタンス自体は更新されるだけで
  参照し続けるため、先に新しい方を作らないと削除に失敗します。
- **ECS サービスの `task_definition` と `desired_count` は Terraform で追いません。**
  CI とスケジューラが更新するため、`ignore_changes` にしています。
- **セキュリティグループのルールの `description` は英語。** EC2 API が
  ASCII の一部しか受け付けないためです。説明は Terraform 側のコメントに書きます。
- **ALB は当面 HTTP のみ。** ドメインが未定で ACM 証明書を発行できないためです。
- **マイグレーションは専用イメージを ECS の単発タスクで流します**（5.6）。
  `drizzle-kit` は devDependency で、`drizzle-orm` は Next.js のバンドルに
  取り込まれるため、どちらもアプリのイメージには独立して入りません。
  Dockerfile の `migrate` ステージが `node_modules` 一式と `drizzle/` を持ちます。
- **踏み台を1台置いています**（`t4g.nano`、月3USD程度）。SSM Session Manager の
  ポートフォワードで、手元から RDS を見るためです。SSH は使わず、受信は許可していません。
  使わない期間は停止できます。

## 残っている作業

| 項目 | 前提 |
| --- | --- |
| ドメイン登録（管理アカウントで `buzzmedia-app.com`） | 連絡先の入力が要るため手作業 |
| SES のドメイン検証・SPF/DKIM/DMARC・サンドボックス解除申請 | 委譲の完了 |
| GitHub Actions からの ECR push と ECS デプロイ（当面は手動） | 5.6 |
| AWS WAF レートベースルール（`/login`、100req/5分/IP、まずカウントモード） | 5.4 |
| AWS Backup（日次・30日保持・Vault Lock） | 5.3。本番のみ |
| CloudWatch アラームと SNS 通知 | 通知先の決定（5.7） |
| 本番環境（`environments/prod`）の再作成 | ドメイン確定 |

## 初回デプロイの手順

`docs/手順書/ECRへのイメージ登録とデプロイ.md` を参照してください。
