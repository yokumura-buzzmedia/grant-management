locals {
  dns_enabled = var.parent_zone_name != "" && var.zone_name != ""
}

# イメージは環境間で共有し、タグで本番とステージングを分ける。
module "registry" {
  source = "../../modules/registry"

  name = "grant-management"
}

# 委譲を受ける側のゾーン。この配下は当アカウントで自由に足せる。
resource "aws_route53_zone" "app" {
  count = local.dns_enabled ? 1 : 0

  name    = var.zone_name
  comment = "Delegated from ${var.parent_zone_name}"
}

data "aws_route53_zone" "parent" {
  count = local.dns_enabled ? 1 : 0

  provider     = aws.parent
  name         = var.parent_zone_name
  private_zone = false
}

# 親から子への委譲。これを入れて初めて外から名前が引ける。
resource "aws_route53_record" "delegation" {
  count = local.dns_enabled ? 1 : 0

  provider = aws.parent
  zone_id  = data.aws_route53_zone.parent[0].zone_id
  name     = var.zone_name
  type     = "NS"
  ttl      = 172800
  records  = aws_route53_zone.app[0].name_servers
}

# メール送信。ドメイン認証はアカウント単位なので、本番とステージングで共有する。
# サブドメインからの送信もこの認証で賄えるため、識別子は1つでよい。
module "ses" {
  source = "../../modules/ses"
  count  = local.dns_enabled ? 1 : 0

  domain                 = var.zone_name
  zone_id                = aws_route53_zone.app[0].zone_id
  notification_email     = var.notification_email
  configuration_set_name = "grant-management"
}
