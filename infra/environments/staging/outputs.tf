output "alb_dns_name" {
  description = "ドメイン設定前の暫定アクセス先"
  value       = module.compute.alb_dns_name
}

output "ecr_repository_url" {
  value = module.registry.repository_url
}

output "uploads_bucket" {
  value = module.storage.bucket_name
}

output "db_address" {
  value = module.database.address
}

output "database_url_secret_arn" {
  value = module.database.database_url_secret_arn
}

output "ecs_cluster_name" {
  value = module.compute.cluster_name
}

output "ecs_service_name" {
  value = module.compute.service_name
}

output "migrate_task_family" {
  description = "aws ecs run-task に渡すタスク定義"
  value       = module.compute.migrate_task_family
}

output "private_subnet_ids" {
  description = "単発タスクを起動するサブネット"
  value       = module.network.private_subnet_ids
}

output "service_security_group_id" {
  description = "単発タスクに付けるセキュリティグループ"
  value       = module.compute.service_security_group_id
}

output "bastion_instance_id" {
  description = "aws ssm start-session の --target に渡す"
  value       = module.bastion.instance_id
}
