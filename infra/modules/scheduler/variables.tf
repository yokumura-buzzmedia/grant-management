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
