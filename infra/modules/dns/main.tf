# ホストゾーンはドメイン登録時に Route 53 が自動で作るため、
# Terraform では参照するだけにする。ここで作ると登録済みのゾーンと二重になり、
# ネームサーバーが食い違う。

data "aws_route53_zone" "this" {
  name         = var.zone_name
  private_zone = false
}

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

  zone_id         = data.aws_route53_zone.this.zone_id
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
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.fqdn
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = false
  }
}
