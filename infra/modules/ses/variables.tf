variable "domain" {
  description = "送信元ドメイン。サブドメインからの送信もこの認証で賄える"
  type        = string
}

variable "zone_id" {
  description = "DKIM・SPF・DMARC のレコードを置くホストゾーン"
  type        = string
}

variable "mail_from_subdomain" {
  description = "カスタム MAIL FROM に使うサブドメイン。バウンスの戻り先になる"
  type        = string
  default     = "mail"
}

variable "dmarc_policy" {
  description = "まず none で実態を観測し、問題がないことを確認してから厳しくする"
  type        = string
  default     = "none"
}

variable "notification_email" {
  description = "バウンス・苦情の通知先。購読確認メールの承認が要る"
  type        = string
}

variable "configuration_set_name" {
  description = "アプリが送信時に指定する。イベントを SNS へ流すために使う"
  type        = string
}
