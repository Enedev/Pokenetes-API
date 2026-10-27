resource "aws_security_group" "alb" {
  name        = "${var.project}-alb"
  description = "HTTP publico hacia el balanceador del canary"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-alb"
  }
}

resource "aws_security_group" "api" {
  name        = "${var.project}-api"
  description = "HTTP de la API solo desde el ALB y salida a RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP desde el ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-api"
  }
}

resource "aws_security_group" "database" {
  name        = "${var.project}-database"
  description = "Postgres solo desde la instancia de la API"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres desde la API"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-database"
  }
}
