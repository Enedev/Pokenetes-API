locals {
  slo          = jsondecode(file("${path.module}/../canary/slo.json"))
  slo_window   = local.slo.window_seconds
  slo_min_reqs = local.slo.min_requests_per_window

  lb_dimension = aws_lb.api.arn_suffix
  tg_dimension = { for track, tg in aws_lb_target_group.track : track => tg.arn_suffix }
}

resource "aws_cloudwatch_log_group" "canary" {
  name              = "/${var.project}/canary"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_group" "gameday" {
  name              = "/${var.project}/gameday"
  retention_in_days = 30
}

resource "aws_cloudwatch_metric_alarm" "canary_5xx_rate" {
  alarm_name          = "${var.project}-canary-5xx-rate"
  alarm_description   = "Abortar: 5xx del canary por encima de ${local.slo.thresholds.error_rate_pct.abort_above}% (canary/slo.json)."
  comparison_operator = "GreaterThanThreshold"
  threshold           = local.slo.thresholds.error_rate_pct.abort_above
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "rate"
    expression  = "IF(requests >= ${local.slo_min_reqs}, 100 * FILL(errors, 0) / requests, 0)"
    label       = "canary 5xx %"
    return_data = true
  }

  metric_query {
    id = "errors"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      period      = local.slo_window
      stat        = "Sum"

      dimensions = {
        LoadBalancer = local.lb_dimension
        TargetGroup  = local.tg_dimension["canary"]
      }
    }
  }

  metric_query {
    id = "requests"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      period      = local.slo_window
      stat        = "Sum"

      dimensions = {
        LoadBalancer = local.lb_dimension
        TargetGroup  = local.tg_dimension["canary"]
      }
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "canary_p95_latency" {
  alarm_name          = "${var.project}-canary-p95-latency"
  alarm_description   = "Abortar: p95 del canary por encima de ${local.slo.thresholds.latency_p95_ms.abort_above} ms (canary/slo.json)."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = local.slo_window
  comparison_operator = "GreaterThanThreshold"
  threshold           = local.slo.thresholds.latency_p95_ms.abort_above / 1000
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = local.lb_dimension
    TargetGroup  = local.tg_dimension["canary"]
  }
}

resource "aws_cloudwatch_metric_alarm" "canary_unhealthy" {
  alarm_name          = "${var.project}-canary-unhealthy"
  alarm_description   = "Abortar: el target del canary no pasa /health."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = local.slo_window
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = local.lb_dimension
    TargetGroup  = local.tg_dimension["canary"]
  }
}

locals {
  abort_alarms = [
    aws_cloudwatch_metric_alarm.canary_5xx_rate,
    aws_cloudwatch_metric_alarm.canary_p95_latency,
    aws_cloudwatch_metric_alarm.canary_unhealthy,
  ]
}
