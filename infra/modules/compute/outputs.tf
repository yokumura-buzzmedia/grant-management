output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "alb_zone_id" {
  value = aws_lb.this.zone_id
}

output "service_security_group_id" {
  value = aws_security_group.service.id
}

output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "service_name" {
  value = aws_ecs_service.this.name
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "service_arn" {
  value = aws_ecs_service.this.id
}

output "migrate_task_family" {
  value = aws_ecs_task_definition.migrate.family
}

output "poll_contracts_task_arn" {
  value = aws_ecs_task_definition.poll_contracts.arn
}

output "poll_contracts_task_family" {
  value = aws_ecs_task_definition.poll_contracts.family
}

output "execution_role_arn" {
  value = aws_iam_role.execution.arn
}
