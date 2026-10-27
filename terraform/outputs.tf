output "api_url" {
  description = "URL publica: el ALB reparte entre stable y canary segun los pesos del listener."
  value       = "http://${aws_lb.api.dns_name}"
}

output "listener_arn" {
  value = aws_lb_listener.http.arn
}

output "target_group_arns" {
  value = { for track, tg in aws_lb_target_group.track : track => tg.arn }
}

output "instance_ids" {
  value = { for track, instance in aws_instance.api : track => instance.id }
}

output "images" {
  description = "Artefactos inmutables desplegados por track."
  value       = { for track, config in local.tracks : track => config.image }
}

output "rollback_function" {
  value = aws_lambda_function.rollback.function_name
}

output "abort_alarms" {
  value = [for alarm in local.abort_alarms : alarm.alarm_name]
}

output "dashboard_url" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${aws_cloudwatch_dashboard.canary.dashboard_name}"
}

output "load_balancer_dimension" {
  value = aws_lb.api.arn_suffix
}

output "target_group_dimensions" {
  value = local.tg_dimension
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "database_endpoint" {
  value = aws_db_instance.main.address
}

output "queue_url" {
  value = aws_sqs_queue.flujo.url
}

output "secret_name" {
  value = aws_secretsmanager_secret.app.name
}
