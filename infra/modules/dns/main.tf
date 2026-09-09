# ホストゾーンは shared スタックが持つ。本番とステージングの両方が使うため、
# どちらかの環境の state に置くと、その環境を作り直したときにもう一方が壊れる。
# ドメイン自体は Organization の管理アカウントで登録し、
# このサブドメインだけを NS 委譲で受け取っている（03_技術選定.md 5.8）。

resource "aws_acm_certificate" "this" {
  domain_name       = var.fqdn
  validation_method = "DNS"

  # 証明書を差し替えるとき、先に新しい方を作らないと
  # リスナーが参照している証明書を消せない。
  lifecycle {
    create_before_destroy = true
  }
}

# ホストゾーンが同じアカウントにあるので、検証レコードを自動で置ける。
# 更新時の再検証も手作業にならない（03_技術選定.md 5.8）。
resource "aws_route53_record" "validation" {
  for_each = {
    for o in aws_acm_certificate.this.domain_validation_options : o.domain_name => {
      name   = o.resource_record_name
      type   = o.resource_record_type
      record = o.resource_record_value
    }
  }

  zone_id         = var.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}

# ALB は IP が変わるため、A レコードではなくエイリアスで向ける。
resource "aws_route53_record" "alb" {
  zone_id = var.zone_id
  name    = var.fqdn
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = false
  }
}
