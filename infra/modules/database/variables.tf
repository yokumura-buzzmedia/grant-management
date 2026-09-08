variable "name" {
  description = "リソース名の接頭辞"
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  description = "RDS を置くプライベートサブネット"
  type        = list(string)
}

variable "engine_version" {
  description = "MySQL のバージョン。major.minor で指定すると最新のパッチが選ばれる"
  type        = string
  default     = "8.4"
}

variable "instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "max_allocated_storage" {
  description = "ストレージ自動スケーリングの上限（03_技術選定.md 5.2）"
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "要件にHA要求はないため既定は Single-AZ（03_技術選定.md 5.2）"
  type        = bool
  default     = false
}

variable "db_name" {
  type    = string
  default = "grant_management"
}

# grant は MySQL の予約語（GRANT）で、RDS がマスターユーザー名に使わせない。
variable "username" {
  type    = string
  default = "grant_app"
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "skip_final_snapshot" {
  type    = bool
  default = false
}
