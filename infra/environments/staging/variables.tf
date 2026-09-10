variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "name" {
  description = "リソース名の接頭辞"
  type        = string
  default     = "grant-management-staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["ap-northeast-1a", "ap-northeast-1c"]
}

variable "desired_count" {
  description = "業務時間中の ECS タスク数。縮小版なので1（03_技術選定.md 5.5）"
  type        = number
  default     = 1
}

variable "image_tag" {
  type    = string
  default = "latest"
}


variable "db_instance_class" {
  description = "ステージングは最小インスタンス（03_技術選定.md 5.5）"
  type        = string
  default     = "db.t4g.micro"
}

variable "schedule_enabled" {
  description = "業務時間外の自動停止を有効にするか"
  type        = bool
  default     = true
}

variable "migrate_image_tag" {
  description = "マイグレーション用イメージのタグ。アプリとは別に push する"
  type        = string
  default     = "migrate-latest"
}

variable "zone_id" {
  description = "shared スタックが作る委譲済みホストゾーン。作成まで空"
  type        = string
  default     = ""
}

variable "fqdn" {
  description = "この環境の完全修飾ドメイン名。ドメイン登録まで空"
  type        = string
  default     = ""
}

# 証明書は module.dns が発行するが、compute へ渡すには先に値が要る。
# 初回は空で apply して証明書を作り、次に ARN を入れて HTTPS を有効にする。
variable "certificate_arn" {
  description = "ALB の HTTPS リスナーに使う証明書。空なら HTTP のまま"
  type        = string
  default     = ""
}

# freeeサイン（05_外部連携仕様.md 3）。
# **検証環境と本番環境は同じテナントを共有し、契約書の置き場をフォルダで分ける。**
# 分離はフォルダIDだけが担保するため、本番のフォルダIDをここへ書かないこと。
#
# client_id / client_secret は Terraform では管理しない。
# aws_secretsmanager_secret に手で値を入れてから、この変数を true にする。
variable "freee_sign_enabled" {
  description = "freeeサイン連携を有効にするか。シークレットに値を入れてから true にする"
  type        = bool
  default     = false
}

variable "freee_sign_base_url" {
  description = "freeeサインAPIのベースURL"
  type        = string
  default     = ""
}

variable "freee_sign_template_id" {
  description = "契約書のテンプレートID。freeeサインの画面で登録したもの"
  type        = string
  default     = ""
}

variable "freee_sign_sender_id" {
  description = "送信ユーザーID。GET /v1/users で調べる"
  type        = string
  default     = ""
}

variable "freee_sign_folder_id" {
  description = "この環境の契約書を入れるフォルダID。**本番と必ず分ける**"
  type        = string
  default     = ""
}
