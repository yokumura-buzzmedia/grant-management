variable "name" {
  description = "リソース名の接頭辞"
  type        = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  description = "踏み台を置くプライベートサブネット"
  type        = string
}

variable "instance_type" {
  description = "ポートフォワードするだけなので最小で足りる"
  type        = string
  default     = "t4g.nano"
}
