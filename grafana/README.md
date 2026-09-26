# Observabilidad en Grafana Cloud

El clúster puede estar apagado. Esto se activa cuando vuelvas a desplegar y pegues el endpoint OTLP.

## 1. Endpoint de Grafana Tempo / métricas

En Grafana Cloud, abre tu stack y entra a **OpenTelemetry** (o Connections → OpenTelemetry). Copia:

- OTLP endpoint (HTTP), algo como `https://otlp-gateway-prod-....grafana.net/otlp`
- El header `Authorization=Basic ...`

Pégalos en `.env.test`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-....grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic ...
```

No subas ese archivo a git.

## 2. Qué exporta el código

- Trazas: el orquestador abre un span `flujo.pokenetes`, `flujo.biblio-express` y `flujo.hospitaline`, y manda `traceparent` más `x-trace-id`.
- Métricas RED por ruta: `http.server.requests`, `http.server.errors`, `http.server.request.duration` (histograma en ms).
- Logs: cada request escribe una línea JSON con `trace_id` a stdout. Fluent Bit ya la sube a CloudWatch.

Phol y Dhani tienen que exportar al mismo endpoint y respetar `traceparent`. Si no, la traza se corta en AWS.

## 3. Dashboard

Dashboards → New → Import → sube `grafana/pokenetes-dashboard.json`.

Elige el datasource Prometheus de tu stack (`grafanacloud-prudentscorpic`).

## 4. Alerta

Alerting → Alert rules → New alert rule.

- Query: `up{scrape_job="aws_pokenetes"}`
- Condition: IS BELOW 1
- For: 5m
- Nombre: `Pokenetes scrape caido`

Cuando se dispare, la página de la alerta es la evidencia. También puedes crear una de latencia:

- Query: `histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_milliseconds_bucket[5m])))`
- Condition: IS ABOVE 2000
