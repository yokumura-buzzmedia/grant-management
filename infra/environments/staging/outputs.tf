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
