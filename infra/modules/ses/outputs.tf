output "configuration_set_name" {
  description = "アプリが送信時に指定する"
  value       = aws_sesv2_configuration_set.this.configuration_set_name
}

output "topic_arn" {
  description = "バウンス・苦情の通知先。CloudWatch アラームの通知にも使える"
  value       = aws_sns_topic.notifications.arn
}

output "mail_from_domain" {
  value = local.mail_from_domain
}

output "identity" {
  value = aws_sesv2_email_identity.this.email_identity
}
