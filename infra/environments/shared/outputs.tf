output "ecr_repository_url" {
  value = module.registry.repository_url
}

output "zone_id" {
  description = "各環境の DNS レコードを置くゾーン"
  value       = try(aws_route53_zone.app[0].zone_id, "")
}

output "zone_name" {
  value = var.zone_name
}

output "name_servers" {
  description = "親ゾーンへ登録される NS。委譲の確認に使う"
  value       = try(aws_route53_zone.app[0].name_servers, [])
}

output "ses_configuration_set_name" {
  description = "アプリが送信時に指定する"
  value       = try(module.ses[0].configuration_set_name, "")
}

output "ses_topic_arn" {
  description = "バウンス・苦情の通知先。監視アラームにも使う"
  value       = try(module.ses[0].topic_arn, "")
}

output "ses_mail_from_domain" {
  value = try(module.ses[0].mail_from_domain, "")
}
