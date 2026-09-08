variable "name" {
  description = "リソース名の接頭辞"
  type        = string
}

variable "cidr" {
  description = "VPC の CIDR"
  type        = string
}

variable "azs" {
  description = "利用するアベイラビリティゾーン"
  type        = list(string)
}
