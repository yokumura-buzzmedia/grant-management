# 見積もり兼発注書と請求書を PDF 添付で送る（05_外部連携仕様.md 4.1）。
# 契約書の署名依頼は freeeサインが送るため、ここからは送らない。
# 仮パスワードもメールやLINEで個別に伝える運用なので送らない。
#
# ドメイン認証は1つで、サブドメインからの送信もこれで賄える。
# 本番は noreply@<domain>、ステージングは noreply@staging.<domain> を使い、
# DMARC レポート上でも区別できるようにする。

locals {
  mail_from_domain = "${var.mail_from_subdomain}.${var.domain}"
}

resource "aws_sesv2_email_identity" "this" {
  email_identity = var.domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# Easy DKIM の3本。これが引けないと署名が検証されず、迷惑メール判定を受ける。
resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.this.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.this.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# 既定のままだと Return-Path が amazonses.com になり、SPF が送信元ドメインと
# 揃わない（DMARC のアライメントが取れない）。自前のサブドメインに寄せる。
resource "aws_sesv2_email_identity_mail_from_attributes" "this" {
  email_identity   = aws_sesv2_email_identity.this.email_identity
  mail_from_domain = local.mail_from_domain

  # レコードが引けないときに送信を止めるのではなく、既定の挙動に落とす。
  # 送れないより、アライメントが崩れても届くほうがましと判断した。
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.zone_id
  name    = local.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${data.aws_region.current.region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# 送信元ドメイン自体にも SPF を置く。MAIL FROM が既定値に落ちた場合の保険。
resource "aws_route53_record" "spf" {
  zone_id = var.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=${var.dmarc_policy}; rua=mailto:${var.notification_email}; fo=1"]
}

# --- バウンスと苦情の受け取り ---
#
# バウンス率が上がると SES 側で送信が止まる。記録して監視する（4.4）。

resource "aws_sns_topic" "notifications" {
  name = "${replace(var.domain, ".", "-")}-ses"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

data "aws_iam_policy_document" "topic" {
  statement {
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.notifications.arn]

    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "notifications" {
  arn    = aws_sns_topic.notifications.arn
  policy = data.aws_iam_policy_document.topic.json
}

# アプリは送信時にこの設定セットを指定する。指定しないとイベントが流れない。
resource "aws_sesv2_configuration_set" "this" {
  configuration_set_name = var.configuration_set_name

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }
}

resource "aws_sesv2_configuration_set_event_destination" "sns" {
  configuration_set_name = aws_sesv2_configuration_set.this.configuration_set_name
  event_destination_name = "bounces-and-complaints"

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE"]

    sns_destination {
      topic_arn = aws_sns_topic.notifications.arn
    }
  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
