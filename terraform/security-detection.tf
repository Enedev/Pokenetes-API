resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/${var.project}/cloudtrail"
  retention_in_days = 30
}

resource "aws_iam_role" "cloudtrail" {
  name = "${var.project}-cloudtrail"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudtrail.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "cloudtrail_logs" {
  name = "${var.project}-cloudtrail-logs"
  role = aws_iam_role.cloudtrail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
    }]
  })
}

resource "aws_s3_bucket" "trail" {
  bucket = "${var.project}-gameday-trail-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "trail" {
  bucket                  = aws_s3_bucket.trail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "trail" {
  bucket = aws_s3_bucket.trail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AWSCloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.trail.arn
      },
      {
        Sid       = "AWSCloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.trail.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = { StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" } }
      }
    ]
  })
}

resource "aws_cloudtrail" "gameday" {
  name                          = "${var.project}-gameday"
  s3_bucket_name                = aws_s3_bucket.trail.id
  include_global_service_events = true
  is_multi_region_trail         = false
  enable_log_file_validation    = true
  cloud_watch_logs_group_arn    = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn     = aws_iam_role.cloudtrail.arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }

  depends_on = [aws_s3_bucket_policy.trail, aws_iam_role_policy.cloudtrail_logs]
}

resource "aws_sns_topic" "security" {
  name = "${var.project}-security"
}

resource "aws_sns_topic_policy" "security" {
  arn = aws_sns_topic.security.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudwatch.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.security.arn
    }]
  })
}

resource "aws_sns_topic_subscription" "security_email" {
  topic_arn = aws_sns_topic.security.arn
  protocol  = "email"
  endpoint  = var.security_notification_email
}

locals {
  gd1_secret_outside_pattern = "{ ($.eventSource = \"secretsmanager.amazonaws.com\") && ($.eventName = \"GetSecretValue\") && ($.userIdentity.sessionContext.sessionIssuer.userName = \"pokenetes-api-instance\") && ($.vpcEndpointId NOT EXISTS) }"
  gd1_honeytoken_pattern     = "{ ($.eventSource = \"secretsmanager.amazonaws.com\") && ($.eventName = \"GetSecretValue\") && ($.requestParameters.secretId = \"*backup-admin*\") }"
}

resource "aws_cloudwatch_log_metric_filter" "secret_outside" {
  name           = "gd1-role-secret-outside-vpce"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = local.gd1_secret_outside_pattern

  metric_transformation {
    name          = "Gd1SecretOutsideVpce"
    namespace     = "Pokenetes/Security"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "honeytoken" {
  name           = "gd1-honeytoken-touched"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = local.gd1_honeytoken_pattern

  metric_transformation {
    name          = "Gd1HoneytokenTouched"
    namespace     = "Pokenetes/Security"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "secret_outside" {
  alarm_name          = "gd1-role-secret-outside-vpce"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Gd1SecretOutsideVpce"
  namespace           = "Pokenetes/Security"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.security.arn]
}

resource "aws_cloudwatch_metric_alarm" "honeytoken" {
  alarm_name          = "gd1-honeytoken-touched"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Gd1HoneytokenTouched"
  namespace           = "Pokenetes/Security"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.security.arn]
}

resource "aws_secretsmanager_secret" "honeytoken" {
  name = "${var.project}/backup-admin-credentials"
}

resource "aws_secretsmanager_secret_version" "honeytoken" {
  secret_id = aws_secretsmanager_secret.honeytoken.id
  secret_string = jsonencode({
    username = "backup-admin"
    password = "synthetic-not-a-real-credential"
  })
}

resource "aws_iam_role_policy" "honeytoken" {
  name = "${var.project}-read-honeytoken"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.honeytoken.arn
    }]
  })
}
