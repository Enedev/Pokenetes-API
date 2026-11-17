locals {
  track_colors = { stable = "#1f77b4", canary = "#ff7f0e" }

  per_track = { for track in keys(local.tracks) : track => { label = track, color = local.track_colors[track] } }

  alb_series = {
    for name in ["RequestCount", "HTTPCode_Target_5XX_Count", "HTTPCode_Target_4XX_Count"] : name => [
      for track in keys(local.tracks) : [
        "AWS/ApplicationELB", name, "LoadBalancer", local.lb_dimension, "TargetGroup", local.tg_dimension[track],
        merge(local.per_track[track], { stat = "Sum" })
      ]
    ]
  }

  latency_series = [
    for pair in setproduct(keys(local.tracks), ["p50", "p95", "p99"]) : [
      "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", local.lb_dimension, "TargetGroup", local.tg_dimension[pair[0]],
      { stat = pair[1], label = "${pair[0]} ${pair[1]}", color = local.track_colors[pair[0]] }
    ]
  ]

  emf_series = {
    for name, stat in { PokemonCreated = "Sum", MemoryRss = "Average", Latency = "p95" } : name => [
      for track in keys(local.tracks) : [
        "Pokenetes/Canary", name, "Track", track, merge(local.per_track[track], { stat = stat })
      ]
    ]
  }

  widget = {
    type   = "metric"
    width  = 12
    height = 6
  }

  dashboard_widgets = [
    {
      type   = "text"
      x      = 0
      y      = 0
      width  = 24
      height = 2
      properties = {
        markdown = "## Canary ${var.project}: stable (azul) vs canary (naranja)\nUmbrales en `canary/slo.json`: 5xx > ${local.slo.thresholds.error_rate_pct.abort_above}% o p95 > ${local.slo.thresholds.latency_p95_ms.abort_above} ms abortan y devuelven el 100% a stable."
      }
    },
    merge(local.widget, {
      x = 0, y = 2
      properties = {
        title   = "Trafico por track (RequestCount)"
        region  = var.aws_region
        view    = "timeSeries"
        period  = 60
        metrics = local.alb_series["RequestCount"]
      }
    }),
    merge(local.widget, {
      x = 12, y = 2
      properties = {
        title  = "Tasa de 5xx por track (%)"
        region = var.aws_region
        view   = "timeSeries"
        period = 60
        metrics = concat(
          [for i, track in keys(local.tracks) : ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", local.lb_dimension, "TargetGroup", local.tg_dimension[track], { id = "e${i}", stat = "Sum", visible = false }]],
          [for i, track in keys(local.tracks) : ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", local.lb_dimension, "TargetGroup", local.tg_dimension[track], { id = "r${i}", stat = "Sum", visible = false }]],
          [for i, track in keys(local.tracks) : [{ expression = "100 * FILL(e${i}, 0) / r${i}", label = "${track} 5xx %", color = local.track_colors[track] }]]
        )
        annotations = {
          horizontal = [{ label = "abort", value = local.slo.thresholds.error_rate_pct.abort_above, color = "#d62728" }]
        }
      }
    }),
    merge(local.widget, {
      x = 0, y = 8
      properties = {
        title   = "Latencia p50 / p95 / p99 por track (s)"
        region  = var.aws_region
        view    = "timeSeries"
        period  = 60
        metrics = local.latency_series
        annotations = {
          horizontal = [{ label = "p95 abort", value = local.slo.thresholds.latency_p95_ms.abort_above / 1000, color = "#d62728" }]
        }
      }
    }),
    merge(local.widget, {
      x = 12, y = 8
      properties = {
        title   = "Errores 4xx por track"
        region  = var.aws_region
        view    = "timeSeries"
        period  = 60
        metrics = local.alb_series["HTTPCode_Target_4XX_Count"]
      }
    }),
    merge(local.widget, {
      x = 0, y = 14
      properties = {
        title  = "CPU por track (%): instancia y proceso"
        region = var.aws_region
        view   = "timeSeries"
        period = 60
        metrics = concat(
          [for track in keys(local.tracks) : ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.api[track].id, merge(local.per_track[track], { stat = "Average", label = "${track} EC2" })]],
          [for track in keys(local.tracks) : ["Pokenetes/Canary", "ProcessCpu", "Track", track, { stat = "Average", label = "${track} proceso", color = local.track_colors[track] }]]
        )
      }
    }),
    merge(local.widget, {
      x = 12, y = 14
      properties = {
        title   = "Memoria RSS del proceso por track (MB)"
        region  = var.aws_region
        view    = "timeSeries"
        period  = 60
        metrics = local.emf_series["MemoryRss"]
      }
    }),
    merge(local.widget, {
      x = 0, y = 20
      properties = {
        title   = "Negocio: pokemon creados por track"
        region  = var.aws_region
        view    = "timeSeries"
        period  = 60
        metrics = local.emf_series["PokemonCreated"]
      }
    }),
    merge(local.widget, {
      x = 12, y = 20
      properties = {
        title   = "Latencia p95 medida en la app por track (ms)"
        region  = var.aws_region
        view    = "timeSeries"
        period  = 60
        metrics = local.emf_series["Latency"]
      }
    }),
    {
      type   = "alarm"
      x      = 0
      y      = 26
      width  = 24
      height = 3
      properties = {
        title  = "Alarmas de aborto del canary"
        alarms = [for alarm in local.abort_alarms : alarm.arn]
      }
    },
    {
      type   = "metric"
      x      = 0
      y      = 29
      width  = 12
      height = 6
      properties = {
        title   = "Lectura del secreto fuera del VPC endpoint"
        view    = "timeSeries"
        region  = var.aws_region
        stat    = "Sum"
        period  = 60
        metrics = [["Pokenetes/Security", "Gd1SecretOutsideVpce"]]
      }
    },
    {
      type   = "metric"
      x      = 12
      y      = 29
      width  = 12
      height = 6
      properties = {
        title   = "Señuelo backup-admin tocado"
        view    = "timeSeries"
        region  = var.aws_region
        stat    = "Sum"
        period  = 60
        metrics = [["Pokenetes/Security", "Gd1HoneytokenTouched"]]
      }
    },
    {
      type   = "alarm"
      x      = 0
      y      = 35
      width  = 24
      height = 3
      properties = {
        title = "Alarmas del experimento de identidad"
        alarms = [
          aws_cloudwatch_metric_alarm.secret_outside.arn,
          aws_cloudwatch_metric_alarm.honeytoken.arn,
        ]
      }
    },
  ]
}

resource "aws_cloudwatch_dashboard" "canary" {
  dashboard_name = "${var.project}-canary"
  dashboard_body = jsonencode({ widgets = local.dashboard_widgets })
}
