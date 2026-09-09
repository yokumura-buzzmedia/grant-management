output "instance_id" {
  description = "aws ssm start-session の --target に渡す"
  value       = aws_instance.this.id
}

output "security_group_id" {
  value = aws_security_group.this.id
}
