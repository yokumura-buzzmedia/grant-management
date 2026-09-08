variable "name" {
  description = "ECR リポジトリ名"
  type        = string
}

variable "keep_image_count" {
  description = "保持するイメージ数"
  type        = number
  default     = 20
}
