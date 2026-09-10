locals {
  account_id     = data.aws_caller_identity.current.account_id
  uploads_bucket = "${var.name}-uploads-${local.account_id}"

  # shared スタックでゾーンを作るまでは空。
  # HTTPS リスナーも Route 53 レコードも作らない。
  dns_enabled = var.zone_id != "" && var.fqdn != ""

  # 署名付きURLで直接 PUT するオリジン。HTTPS で使うため証明書が要る。
  app_origins = local.dns_enabled ? ["https://${var.fqdn}"] : []
}

module "network" {
  source = "../../modules/network"

  name = var.name
  cidr = var.vpc_cidr
  azs  = var.azs
}

module "storage" {
  source = "../../modules/storage"

  bucket_name          = local.uploads_bucket
  cors_allowed_origins = local.app_origins
}

# ECR とホストゾーンは shared スタックが持つ。環境を作り直しても
# 消えないようにするため、ここでは参照だけする。
data "aws_ecr_repository" "app" {
  name = "grant-management"
}

module "database" {
  source = "../../modules/database"

  name       = var.name
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids

  # ステージングは検証用のダミーデータしか持たない（03_技術選定.md 5.5）。
  # 作り直しを妨げないよう、削除保護と最終スナップショットを外す。
  instance_class      = var.db_instance_class
  deletion_protection = false
  skip_final_snapshot = true
}

module "compute" {
  source = "../../modules/compute"

  name               = var.name
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids

  image         = "${data.aws_ecr_repository.app.repository_url}:${var.image_tag}"
  migrate_image = "${data.aws_ecr_repository.app.repository_url}:${var.migrate_image_tag}"
  desired_count = var.desired_count

  certificate_arn = var.certificate_arn

  uploads_bucket_arn      = module.storage.bucket_arn
  database_url_secret_arn = module.database.database_url_secret_arn

  freee_sign_secret_arn = var.freee_sign_enabled ? aws_secretsmanager_secret.freee_sign.arn : ""

  environment = merge(
    {
      NODE_ENV  = "production"
      PORT      = "3000"
      S3_REGION = var.region
      S3_BUCKET = module.storage.bucket_name
    },
    # 有効にするまでは何も渡さない。アプリ側は未設定として扱い、画面に理由を出す
    var.freee_sign_enabled ? {
      FREEE_SIGN_MODE     = "live"
      FREEE_SIGN_BASE_URL = var.freee_sign_base_url
      # freeeサイン側の登録値と完全一致していないと認可が弾かれる。
      # 取り違えを防ぐため、この環境のFQDNから組み立てる
      FREEE_SIGN_REDIRECT_URI = "https://${var.fqdn}/settings/freee-sign/callback"
      FREEE_SIGN_TEMPLATE_ID  = var.freee_sign_template_id
      FREEE_SIGN_SENDER_ID    = var.freee_sign_sender_id
      FREEE_SIGN_FOLDER_ID    = var.freee_sign_folder_id
    } : {}
  )
}

# freeeサインのクレデンシャル（05_外部連携仕様.md 3.2）。
# **値は Terraform で管理しない。** state に平文で残るため、
# 作成後に aws secretsmanager put-secret-value で入れる。
resource "aws_secretsmanager_secret" "freee_sign" {
  name        = "${var.name}/freee-sign"
  description = "freeeサインAPIの client_id / client_secret"
}

# 業務時間外は ECS のタスク数を0にし、RDS を停止する（03_技術選定.md 5.5）。
module "scheduler" {
  source = "../../modules/scheduler"

  name    = var.name
  enabled = var.schedule_enabled

  cluster_name  = module.compute.cluster_name
  cluster_arn   = module.compute.cluster_arn
  service_name  = module.compute.service_name
  service_arn   = module.compute.service_arn
  desired_count = var.desired_count

  db_instance_identifier = module.database.instance_identifier
  db_instance_arn        = module.database.instance_arn
}

# ドメイン登録後に有効化する。証明書の検証レコードも同じゾーンに置く。
module "dns" {
  source = "../../modules/dns"
  count  = local.dns_enabled ? 1 : 0

  zone_id      = var.zone_id
  fqdn         = var.fqdn
  alb_dns_name = module.compute.alb_dns_name
  alb_zone_id  = module.compute.alb_zone_id
}

# 手元から RDS を見るための踏み台。SSM のポートフォワードで使う。
module "bastion" {
  source = "../../modules/bastion"

  name      = var.name
  vpc_id    = module.network.vpc_id
  subnet_id = module.network.private_subnet_ids[0]
}

# database と compute が相互に依存しないよう、許可ルールだけここで足す。
resource "aws_vpc_security_group_ingress_rule" "db_from_service" {
  security_group_id            = module.database.security_group_id
  description                  = "From ECS tasks"
  referenced_security_group_id = module.compute.service_security_group_id
  from_port                    = 3306
  to_port                      = 3306
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "db_from_bastion" {
  security_group_id            = module.database.security_group_id
  description                  = "From bastion"
  referenced_security_group_id = module.bastion.security_group_id
  from_port                    = 3306
  to_port                      = 3306
  ip_protocol                  = "tcp"
}
