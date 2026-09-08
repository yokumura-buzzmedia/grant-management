locals {
  account_id     = data.aws_caller_identity.current.account_id
  uploads_bucket = "${var.name}-uploads-${local.account_id}"
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
  cors_allowed_origins = var.cors_allowed_origins
}

# イメージは環境間で共有する。タグで本番とステージングを分ける。
module "registry" {
  source = "../../modules/registry"

  name = "grant-management"
}

module "database" {
  source = "../../modules/database"

  name       = var.name
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
}

module "compute" {
  source = "../../modules/compute"

  name               = var.name
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids

  image         = "${module.registry.repository_url}:${var.image_tag}"
  desired_count = var.desired_count

  uploads_bucket_arn      = module.storage.bucket_arn
  database_url_secret_arn = module.database.database_url_secret_arn

  environment = {
    NODE_ENV  = "production"
    PORT      = "3000"
    S3_REGION = var.region
    S3_BUCKET = module.storage.bucket_name
  }
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
