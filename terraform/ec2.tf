data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_caller_identity" "current" {}

locals {
  registry = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"

  tracks = {
    stable = { image = var.stable_image, subnet_id = aws_subnet.public_a.id }
    canary = { image = var.canary_image, subnet_id = aws_subnet.public_b.id }
  }
}

resource "aws_iam_role" "api" {
  name = "${var.project}-api-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "secrets" {
  name = "${var.project}-read-secret"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.app.arn
    }]
  })
}

resource "aws_iam_role_policy" "logs" {
  name = "${var.project}-write-logs"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
      Resource = "${aws_cloudwatch_log_group.canary.arn}:*"
    }]
  })
}

resource "aws_iam_instance_profile" "api" {
  name = "${var.project}-api-instance"
  role = aws_iam_role.api.name
}

resource "aws_instance" "api" {
  for_each = local.tracks

  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = var.instance_type
  subnet_id                   = each.value.subnet_id
  vpc_security_group_ids      = [aws_security_group.api.id]
  iam_instance_profile        = aws_iam_instance_profile.api.name
  monitoring                  = true
  user_data_replace_on_change = true

  user_data = <<-EOF
    #!/bin/bash
    set -eux
    dnf install -y docker
    systemctl enable --now docker
    systemctl enable --now amazon-ssm-agent || true
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${local.registry}
    docker pull ${each.value.image}
    docker rm -f ${var.project}-api || true
    docker run -d --name ${var.project}-api --restart unless-stopped -p 80:3000 \
      --log-driver awslogs \
      --log-opt awslogs-region=${var.aws_region} \
      --log-opt awslogs-group=${aws_cloudwatch_log_group.canary.name} \
      --log-opt awslogs-stream=${each.key} \
      -e AWS_REGION=${var.aws_region} \
      -e AWS_SECRETS_MANAGER_SECRET_ID=${aws_secretsmanager_secret.app.name} \
      -e NODE_ENV=test \
      -e APP_TRACK=${each.key} \
      -e METRICS_EMF=true \
      ${each.value.image}
  EOF

  lifecycle {
    precondition {
      condition     = each.value.image != ""
      error_message = "Falta la imagen del track ${each.key}; pasala por digest."
    }
  }

  depends_on = [
    aws_secretsmanager_secret_version.app,
    aws_iam_role_policy.logs,
  ]

  tags = {
    Name  = "${var.project}-api-${each.key}"
    Track = each.key
  }
}
