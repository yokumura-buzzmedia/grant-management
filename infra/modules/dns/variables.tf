variable "zone_name" {
  description = "Route 53 の公開ホストゾーン。ドメイン登録時に自動で作られる"
  type        = string
}

variable "fqdn" {
  description = "この環境で使う完全修飾ドメイン名"
  type        = string
}

variable "alb_dns_name" {
  type = string
}

variable "alb_zone_id" {
  type = string
}
