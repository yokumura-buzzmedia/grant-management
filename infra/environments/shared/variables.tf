variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "profile" {
  description = "GrantManagement アカウント（024430211741）"
  type        = string
  default     = "grant"
}

variable "parent_profile" {
  description = "Organization の管理アカウント（982227460789）。ドメインの登録先"
  type        = string
  default     = "buzzmedia"
}

variable "parent_zone_name" {
  description = "親アカウントが持つドメイン。登録するまで空"
  type        = string
  default     = ""
}

variable "zone_name" {
  description = "このアカウントへ委譲するサブドメイン。登録するまで空"
  type        = string
  default     = ""
}
