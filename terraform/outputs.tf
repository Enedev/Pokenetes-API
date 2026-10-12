output "api_url" {
  description = "URL publica de la API cuando el contenedor ya esta instalado."
  value       = "http://${aws_instance.api.public_ip}"
}

output "instance_id" {
  description = "Instancia donde el pipeline instala el contenedor."
  value       = aws_instance.api.id
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
