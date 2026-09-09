output "security_group_id" {
  value = aws_security_group.this.id
}

output "endpoint" {
  value = aws_db_instance.this.endpoint
}

output "address" {
  value = aws_db_instance.this.address
}

output "port" {
  value = aws_db_instance.this.port
}

output "database_url_secret_arn" {
  value = aws_secretsmanager_secret.database_url.arn
}

output "instance_identifier" {
  value = aws_db_instance.this.identifier
}

output "instance_arn" {
  value = aws_db_instance.this.arn
}
