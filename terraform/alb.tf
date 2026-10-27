resource "aws_lb" "api" {
  name               = "${var.project}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = {
    Name = "${var.project}-alb"
  }
}

resource "aws_lb_target_group" "track" {
  for_each = local.tracks

  name                 = "${var.project}-${each.key}"
  port                 = 80
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "instance"
  deregistration_delay = 10

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Track = each.key
  }
}

resource "aws_lb_target_group_attachment" "track" {
  for_each = local.tracks

  target_group_arn = aws_lb_target_group.track[each.key].arn
  target_id        = aws_instance.api[each.key].id
  port             = 80
}

# Terraform only creates the split at Stage 0 (100/0); the rollout scripts and the
# rollback Lambda own the weights afterwards, so a re-apply never undoes a promotion.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.track["stable"].arn
        weight = 100
      }

      target_group {
        arn    = aws_lb_target_group.track["canary"].arn
        weight = 0
      }

      stickiness {
        enabled  = var.sticky_sessions
        duration = var.sticky_seconds
      }
    }
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}

resource "aws_lb_listener_rule" "canary_header" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  condition {
    http_header {
      http_header_name = "x-canary"
      values           = ["true"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.track["canary"].arn
  }
}
