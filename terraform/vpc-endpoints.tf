resource "aws_security_group" "secrets_endpoint" {
  name        = "${var.project}-secrets-endpoint"
  description = "HTTPS al endpoint de Secrets Manager solo desde la API"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTPS desde la API"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = [aws_subnet.public_a.id]
  security_group_ids  = [aws_security_group.secrets_endpoint.id]
  private_dns_enabled = true
}
