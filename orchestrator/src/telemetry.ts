import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let started = false;

export function startTelemetry(serviceName: string): void {
  if (started || process.env.OTEL_SDK_DISABLED === 'true') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  started = true;
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
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
      }),
    ],
  });
  sdk.start();
}
