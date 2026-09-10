variable "name" {
  description = "リソース名の接頭辞"
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  description = "ALB を置くサブネット"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "ECS タスクを置くサブネット"
  type        = list(string)
}

variable "image" {
  description = "起動するコンテナイメージ"
  type        = string
}

variable "desired_count" {
  description = "起動するタスク数。ECR にイメージを push するまでは 0 にしておく"
  type        = number
  default     = 0
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "container_port" {
  type    = number
  default = 3000
}

variable "health_check_path" {
  description = "ALB のヘルスチェック先。ログイン画面は認証不要で 200 を返す"
  type        = string
  default     = "/login"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "uploads_bucket_arn" {
  type = string
}

variable "database_url_secret_arn" {
  type = string
}

# freeeサインの client_id / client_secret を入れた Secrets Manager のシークレット。
# 空ならタスクへ渡さない。値を入れる前に参照するとタスクが起動できないため、
# シークレットを作って値を入れてから、この ARN を設定する（05_外部連携仕様.md 3.2）。
variable "freee_sign_secret_arn" {
  description = "freeeサインのクレデンシャル。JSON の client_id / client_secret を参照する"
  type        = string
  default     = ""
}

variable "environment" {
  description = "コンテナに渡す環境変数"
  type        = map(string)
  default     = {}
}

variable "migrate_image" {
  description = "マイグレーション用のイメージ。ECS の単発タスクで使う"
  type        = string
}

variable "certificate_arn" {
  description = "ACM の証明書。空なら HTTPS リスナーを作らず、HTTP のまま転送する"
  type        = string
  default     = ""
}
