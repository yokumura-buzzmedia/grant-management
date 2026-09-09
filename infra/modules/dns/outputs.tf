output "certificate_arn" {
  description = "検証が終わった証明書。ALB の HTTPS リスナーに渡す"
  value       = aws_acm_certificate_validation.this.certificate_arn
}

output "fqdn" {
  value = aws_route53_record.alb.fqdn
}
