resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.project}/terraform"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(merge({
    DATABASE_URL             = "postgresql://pokenetes:${random_password.database.result}@${aws_db_instance.main.address}:5432/pokenetes"
    SUPABASE_URL             = "https://placeholder.supabase.co"
    SUPABASE_PUBLISHABLE_KEY = "placeholder-publishable"
    SUPABASE_SECRET_KEY      = "placeholder-secret"
    SUPABASE_JWKS_URL        = "https://placeholder.supabase.co/auth/v1/.well-known/jwks.json"
    AWS_SQS_QUEUE_URL        = aws_sqs_queue.flujo.url
    BIBLIO_API_URL           = "https://biblio-express-final-api-cruuw4ggmq-uc.a.run.app"
    HOSPITALINE_API_URL      = "http://34.121.168.216"
    BIBLIO_LAST_PATH         = "/api/v5/books/last"
    BIBLIO_LIST_PATH         = "/api/v5/books"
    HOSPITALINE_LAST_PATH    = "/api/v5/hospitals/last"
    HOSPITALINE_LIST_PATH    = "/api/v5/hospitals"
  }, var.fault_token == "" ? {} : { FAULT_TOKEN = var.fault_token }))
}
