import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { context, metrics, propagation, ROOT_CONTEXT, SpanKind, trace, type Context, type Counter, type Histogram, type Span } from '@opentelemetry/api';
import type { FastifyInstance } from 'fastify';

let duration: Histogram | undefined;
let requests: Counter | undefined;
let errors: Counter | undefined;
const requestSpans = new WeakMap<object, Span>();
const requestContextStore = new AsyncLocalStorage<Context>();

function instruments() {
  if (!duration || !requests || !errors) {
    const meter = metrics.getMeter('pokenetes');
    duration = meter.createHistogram('http.server.request.duration', { unit: 's' });
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
  const parent = requestContextStore.getStore() ?? context.active();
  propagation.inject(parent, headers);
  const spanContext = trace.getSpan(parent)?.spanContext();
  if (spanContext && !/^0+$/.test(spanContext.traceId)) {
    const flags = (spanContext.traceFlags ?? 1).toString(16).padStart(2, '0');
    headers.traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
  }
  return headers;
}

export function v2TraceFields(request: { headers: Record<string, unknown> }): {
  'x-trace_id': string;
  'trace-id'?: string;
  'span-id'?: string;
} {
  const header = request.headers['x-trace-id'];
  const span = requestSpans.get(request) ?? trace.getActiveSpan();
  const spanContext = span?.spanContext();
  const otelTraceId = spanContext?.traceId;
  const spanId = spanContext?.spanId;
  const fields: {
    'x-trace_id': string;
    'trace-id'?: string;
    'span-id'?: string;
  } = {
    'x-trace_id': resolveTraceId(typeof header === 'string' ? header : undefined),
  };

  if (otelTraceId && spanId && !/^0+$/.test(otelTraceId)) {
    fields['trace-id'] = otelTraceId;
    fields['span-id'] = spanId;
  }

  return fields;
}

export function observeRequests(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    const parent = propagation.extract(ROOT_CONTEXT, request.headers);
    const route = request.routeOptions?.url ?? request.url;
    const span = trace.getTracer('pokenetes-api').startSpan(`${request.method} ${route}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.request.method': request.method,
        'http.route': route,
        'url.path': request.url,
      },
    }, parent);
    requestSpans.set(request, span);
    const ctx = trace.setSpan(parent, span);
    requestContextStore.run(ctx, () => context.with(ctx, () => done()));
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url ?? request.url;
    const status = reply.statusCode;
    const durationMs = reply.elapsedTime;
    const span = requestSpans.get(request);
    span?.setAttribute('http.response.status_code', status);
    span?.end();
    requestSpans.delete(request);
    const traceIdHeader = request.headers['x-trace-id'];
    const otelTraceId = span?.spanContext().traceId ?? trace.getActiveSpan()?.spanContext().traceId;
    const attrs = {
      'http.request.method': request.method,
      'http.route': route,
      'http.response.status_code': status,
    };
    const series = instruments();
    series.duration.record(durationMs / 1000, attrs);
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

export function canonicalTraceId(headerValue: string | string[] | undefined): string {
  const otelTraceId = trace.getActiveSpan()?.spanContext().traceId;
  if (otelTraceId && !/^0+$/.test(otelTraceId)) {
    return otelTraceId;
  }

  return resolveTraceId(headerValue);
}
