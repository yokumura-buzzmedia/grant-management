output "certificate_arn" {
  description = "検証が終わった証明書。ALB の HTTPS リスナーに渡す"
  value       = aws_acm_certificate_validation.this.certificate_arn
}

output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}

output "fqdn" {
  value = aws_route53_record.alb.fqdn
}
