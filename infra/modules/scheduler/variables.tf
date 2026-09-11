variable "name" {
  description = "リソース名の接頭辞"
  type        = string
}

variable "enabled" {
  description = "スケジュールを有効にするか"
  type        = bool
  default     = true
}

variable "timezone" {
  type    = string
  default = "Asia/Tokyo"
}

variable "cluster_name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "service_name" {
  type = string
}

variable "service_arn" {
  type = string
}

variable "desired_count" {
  description = "起動時に立てるタスク数"
  type        = number
  default     = 1
}

variable "db_instance_identifier" {
  type = string
}

variable "db_instance_arn" {
  type = string
}

# RDS は起動に数分かかるため、ECS より前に起こす。
variable "db_start_cron" {
  type    = string
  default = "cron(15 9 ? * MON-FRI *)"
}

variable "ecs_start_cron" {
  type    = string
  default = "cron(30 9 ? * MON-FRI *)"
}

variable "ecs_stop_cron" {
  type    = string
  default = "cron(30 19 ? * MON-FRI *)"
}

# ECS を止めてから DB を止める。接続が残ったままの停止を避ける。
variable "db_stop_cron" {
  type    = string
  default = "cron(35 19 ? * MON-FRI *)"
}

# 契約書の締結を検知するポーリング（05_外部連携仕様.md 3.9）。
#
# 有効・無効はタスク定義の ARN ではなく真偽値で切り替える。
# ARN は apply するまで確定しないため、count の条件にすると plan が通らない。
variable "poll_contracts_enabled" {
  description = "ポーリングのスケジュールを作るか"
  type        = bool
  default     = false
}

variable "poll_contracts_task_arn" {
  description = "ポーリング用タスク定義の ARN"
  type        = string
  default     = ""
}

variable "poll_contracts_cron" {
  description = "ポーリングの間隔。業務時間内だけ回す（時間外は RDS が停止している）"
  type        = string
  default     = "cron(0/10 9-19 ? * MON-FRI *)"
}

variable "private_subnet_ids" {
  description = "単発タスクを置くサブネット"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "単発タスクに付けるセキュリティグループ"
  type        = list(string)
  default     = []
}

variable "task_role_arns" {
  description = "RunTask で渡すロール（実行ロールとタスクロール）"
  type        = list(string)
  default     = []
}
