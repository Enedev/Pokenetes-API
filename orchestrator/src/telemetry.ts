import { diag, DiagConsoleLogger, DiagLogLevel, propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let started = false;

export function startTelemetry(serviceName: string): void {
  if (started || process.env.OTEL_SDK_DISABLED === 'true') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.log(JSON.stringify({ msg: 'telemetry skipped', service: serviceName }));
    return;
  }

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
  started = true;
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.namespace': 'pokenetes',
      'deployment.environment.name': process.env.NODE_ENV ?? 'test',
      'cloud.provider': 'aws',
      'k8s.namespace.name': process.env.POD_NAMESPACE ?? 'pokenetes',
      'k8s.pod.name': process.env.POD_NAME ?? 'local',
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: false },
        '@opentelemetry/instrumentation-undici': { enabled: false },
      }),
    ],
  });
  sdk.start();
  console.log(JSON.stringify({
    msg: 'telemetry started',
    service: serviceName,
    hasAuthHeader: Boolean(process.env.OTEL_EXPORTER_OTLP_HEADERS?.includes('Authorization')),
  }));
}
