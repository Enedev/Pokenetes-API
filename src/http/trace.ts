import { randomUUID } from 'crypto';
import { context, metrics, propagation, trace, type Counter, type Histogram } from '@opentelemetry/api';
import type { FastifyInstance } from 'fastify';

let duration: Histogram | undefined;
let requests: Counter | undefined;
let errors: Counter | undefined;

function instruments() {
  if (!duration || !requests || !errors) {
    const meter = metrics.getMeter('pokenetes');
    duration = meter.createHistogram('http.server.request.duration', { unit: 'ms' });
    requests = meter.createCounter('http.server.requests');
    errors = meter.createCounter('http.server.errors');
  }
  return { duration, requests, errors };
}

export function tracedHeaders(traceId: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-trace-id': traceId,
  };
  propagation.inject(context.active(), headers);
  return headers;
}

export function observeRequests(app: FastifyInstance): void {
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url ?? request.url;
    const status = reply.statusCode;
    const durationMs = reply.elapsedTime;
    const traceIdHeader = request.headers['x-trace-id'];
    const otelTraceId = trace.getActiveSpan()?.spanContext().traceId;
    const attrs = {
      'http.method': request.method,
      'http.route': route,
      'http.status_code': status,
    };
    const series = instruments();
    series.duration.record(durationMs, attrs);
    series.requests.add(1, attrs);
    if (status >= 400) series.errors.add(1, attrs);

    if (process.env.NODE_ENV === 'test') return;
    console.log(JSON.stringify({
      msg: 'request',
      trace_id: traceIdHeader,
      otel_trace_id: otelTraceId,
      method: request.method,
      route,
      status,
      duration_ms: Math.round(durationMs),
    }));
  });
}

export function resolveTraceId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  return randomUUID();
}
