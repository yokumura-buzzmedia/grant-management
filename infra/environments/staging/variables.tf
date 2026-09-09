variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "name" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "grant-management-staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["ap-northeast-1a", "ap-northeast-1c"]
}

variable "desired_count" {
  description = "業務時間中の ECS タスク数。縮小版なので1（03_技術選定.md 5.5）"
  type        = number
  default     = 1
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "cors_allowed_origins" {
  description = "S3 への直接 PUT を許可するオリジン。ALB の DNS 名が決まってから設定する"
  type        = list(string)
  default     = []
}

variable "db_instance_class" {
  description = "ステージングは最小インスタンス（03_技術選定.md 5.5）"
  type        = string
  default     = "db.t4g.micro"
}

variable "schedule_enabled" {
  description = "業務時間外の自動停止を有効にするか"
  type        = bool
  default     = true
}

variable "migrate_image_tag" {
  description = "マイグレーション用イメージのタグ。アプリとは別に push する"
  type        = string
  default     = "migrate-latest"
}
