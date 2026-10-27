data "archive_file" "rollback" {
  type        = "zip"
  source_file = "${path.module}/lambda/rollback.mjs"
  output_path = "${path.module}/.build/rollback.zip"
}

resource "aws_iam_role" "rollback" {
  name = "${var.project}-canary-rollback"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rollback_logs" {
  role       = aws_iam_role.rollback.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "rollback_listener" {
  name = "${var.project}-move-canary-weight"
  role = aws_iam_role.rollback.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:ModifyListener"]
        Resource = aws_lb_listener.http.arn
      },
      {
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:DescribeListeners"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_lambda_function" "rollback" {
  function_name    = "${var.project}-canary-rollback"
  role             = aws_iam_role.rollback.arn
  runtime          = "nodejs20.x"
  handler          = "rollback.handler"
  filename         = data.archive_file.rollback.output_path
  source_code_hash = data.archive_file.rollback.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      LISTENER_ARN  = aws_lb_listener.http.arn
      STABLE_TG_ARN = aws_lb_target_group.track["stable"].arn
      CANARY_TG_ARN = aws_lb_target_group.track["canary"].arn
    }
  }
}

resource "aws_cloudwatch_event_rule" "canary_alarm" {
  name        = "${var.project}-canary-alarm"
  description = "Una alarma de aborto del canary pasa a ALARM."
  state       = var.auto_rollback ? "ENABLED" : "DISABLED"

  event_pattern = jsonencode({
    source        = ["aws.cloudwatch"]
    "detail-type" = ["CloudWatch Alarm State Change"]
    resources     = [for alarm in local.abort_alarms : alarm.arn]
    detail = {
      state = { value = ["ALARM"] }
    }
  })
}

resource "aws_cloudwatch_event_target" "rollback" {
  rule = aws_cloudwatch_event_rule.canary_alarm.name
  arn  = aws_lambda_function.rollback.arn
}

resource "aws_lambda_permission" "events" {
  statement_id  = "AllowCanaryAlarmRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rollback.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.canary_alarm.arn
}
