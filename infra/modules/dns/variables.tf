variable "zone_id" {
  description = "shared スタックが作る委譲済みホストゾーン"
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
