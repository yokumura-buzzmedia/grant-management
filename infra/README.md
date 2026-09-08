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
  environments/
    prod/       本番
```

## 前提

- Terraform 1.11 以上（S3 ネイティブロックを使うため）
- AWS プロファイル `grant`（`024430211741` へ AssumeRole する設定）

```bash
export AWS_PROFILE=grant
terraform -chdir=infra/environments/prod init
terraform -chdir=infra/environments/prod plan
```

## state

`s3://grant-management-tfstate-024430211741` に置いています。
バージョニングと暗号化は有効です。排他制御は S3 のロックファイルで行うため、
DynamoDB テーブルは作っていません。

このバケットだけは Terraform では作れないため（鶏卵）、AWS CLI で作成しました。

## 決めたこと

- **NAT ゲートウェイは1台。** 1台あたり約45USD/月かかるため、冗長化より費用を優先しました。
  AZ 障害時はプライベート側の外向き通信が止まります。ECS タスク自体は2AZに分散します。
  freee サイン API への外向き通信があるため、NAT を無くすことはできません。
- **S3 はゲートウェイ型エンドポイント経由。** アップロードファイルの転送量が
  そのまま NAT のデータ処理料金になるのを避けます。エンドポイント自体は無料です。
- **RDS のパスワードは Terraform が生成し、組み立て済みの `DATABASE_URL` を
  Secrets Manager に置きます。** アプリが接続文字列1本を読む実装のためです。
  RDS 管理のシークレット（`manage_master_user_password`）はユーザー名とパスワードを
  別々に持つ形式なので、タスク定義から1変数として渡せません。
  パスワードは記号を含めません。URL エンコードが要る文字を最初から避けるためです。
- **照合順序はパラメータグループで明示。** `utf8mb4_ja_0900_as_cs` を使います。
  MySQL 8 の既定 `utf8mb4_0900_ai_ci` は濁点・半濁点を区別しません。
- **ECS サービスの `task_definition` と `desired_count` は Terraform で追いません。**
  CI がデプロイのたびに更新するため、`ignore_changes` にしています。
- **ALB は当面 HTTP のみ。** ドメインが未定で ACM 証明書を発行できないためです。

## 残っている作業

| 項目 | 前提 |
| --- | --- |
| ACM 証明書・HTTPS リスナー・HTTP→HTTPS リダイレクト | ドメイン確定 |
| Route 53 ホストゾーンと A レコード | ドメイン確定 |
| SES のドメイン検証・SPF/DKIM/DMARC・サンドボックス解除申請 | ドメイン確定 |
| S3 の CORS 設定（`cors_allowed_origins`） | ドメイン確定 |
| AWS WAF レートベースルール（`/login`、100req/5分/IP、まずカウントモード） | 5.4 |
| AWS Backup（日次・30日保持・Vault Lock） | 5.3 |
| CloudWatch アラームと SNS 通知 | 通知先の決定（5.7） |
| ステージング環境（`environments/staging`）と EventBridge での起動停止 | 5.5 |
| GitHub Actions からの ECR push と ECS デプロイ | 5.6 |

## 初回デプロイの手順

1. イメージをビルドして ECR へ push する
2. `terraform.tfvars` の `desired_count` を 2 にして apply する
3. マイグレーションを ECS の単発タスクとして実行する
4. `alb_dns_name` にアクセスして疎通を確認する
