resource "aws_sqs_queue" "dlq" {
  name = "${var.project}-flujo-dlq"
}

resource "aws_sqs_queue" "flujo" {
  name                       = "${var.project}-flujo"
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}
