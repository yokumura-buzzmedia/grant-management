variable "bucket_name" {
  description = "アップロードファイルを置くバケット名"
  type        = string
}

variable "cors_allowed_origins" {
  description = "ブラウザから直接 PUT する際に許可するオリジン。ドメイン確定まで空でよい"
  type        = list(string)
  default     = []
}

variable "force_destroy" {
  description = "terraform destroy でバケットの中身ごと消すか。本番は false"
  type        = bool
  default     = false
}
