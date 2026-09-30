import { context, metrics, propagation, ROOT_CONTEXT, SpanKind, trace, type Context, type Counter, type Histogram, type Span } from '@opentelemetry/api';
import type { FastifyInstance } from 'fastify';
import { FetchLike } from './types';

let duration: Histogram | undefined;
let requests: Counter | undefined;
let errors: Counter | undefined;

function instruments() {
  if (!duration || !requests || !errors) {
    const meter = metrics.getMeter('pokenetes-orchestrator');
    duration = meter.createHistogram('http.server.request.duration', { unit: 's' });
    requests = meter.createCounter('http.server.requests');
    errors = meter.createCounter('http.server.errors');
  }
  return { duration, requests, errors };
}

export function canonicalTraceId(headerValue: string | string[] | undefined): string {
  const otelTraceId = trace.getActiveSpan()?.spanContext().traceId;
  if (otelTraceId && !/^0+$/.test(otelTraceId)) {
    return otelTraceId;
  }

  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  return crypto.randomUUID();
}

export function contextFromTraceparent(traceparent?: string): Context {
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(traceparent ?? '');
  if (!match) return ROOT_CONTEXT;

  return trace.setSpanContext(ROOT_CONTEXT, {
    traceId: match[1],
    spanId: match[2],
    traceFlags: Number.parseInt(match[3], 16),
    isRemote: true,
  });
}

function formatTraceparent(spanContext: { traceId: string; spanId: string; traceFlags: number } | undefined): string | undefined {
  if (!spanContext || !/^[0-9a-f]{32}$/i.test(spanContext.traceId) || /^0+$/.test(spanContext.traceId)) {
    return undefined;
  }

  const flags = (spanContext.traceFlags ?? 1).toString(16).padStart(2, '0');
  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}

export function tracedHeaders(traceId: string, parent: Context = context.active()): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-trace-id': traceId,
  };
  propagation.inject(parent, headers);
  const traceparent = formatTraceparent(trace.getSpan(parent)?.spanContext());
  if (traceparent) headers.traceparent = traceparent;
  return headers;
}

const requestSpans = new WeakMap<object, Span>();

export function requestContext(request: object): Context {
  const span = requestSpans.get(request);
  return span ? trace.setSpan(ROOT_CONTEXT, span) : context.active();
}

export function observeRequests(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    const parent = propagation.extract(ROOT_CONTEXT, request.headers);
    const route = request.routeOptions?.url ?? request.url;
    const span = trace.getTracer('pokenetes-orchestrator').startSpan(`${request.method} ${route}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.request.method': request.method,
        'http.route': route,
        'url.path': request.url,
      },
    }, parent);
    requestSpans.set(request, span);
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

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

const PEER_TRACE_FIELDS = ['api', 'version', 'x-trace_id', 'trace-id', 'span-id', 'entity'] as const;

function keepPeerTrace(body: Record<string, unknown>, record: unknown): unknown {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record;
  }

  const traced = { ...(record as Record<string, unknown>) };
  for (const key of PEER_TRACE_FIELDS) {
    if (body[key] !== undefined && traced[key] === undefined) {
      traced[key] = body[key];
    }
  }
  return traced;
}

function pickLast(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.at(-1) ?? null;
  }

  if (payload && typeof payload === 'object') {
    const body = payload as Record<string, unknown>;
    if (body.local !== undefined) {
      return keepPeerTrace(body, body.local);
    }

    for (const key of ['data', 'books', 'users', 'loans', 'hospitals', 'doctors', 'pacientes', 'pokemon']) {
      if (Array.isArray(body[key])) {
        return (body[key] as unknown[]).at(-1) ?? null;
      }
    }
  }

  return payload;
}

export async function fetchStep(options: {
  baseUrl?: string;
  lastPath: string;
  listPath: string;
  traceId: string;
  parentContext?: Context;
  fetchImpl: FetchLike;
}): Promise<{ status: 'ok' | 'skipped' | 'failed'; source?: string; data?: unknown; error?: string }> {
  const baseUrl = options.baseUrl?.trim();

  if (!baseUrl) {
    return { status: 'skipped', error: 'URL not configured yet' };
  }

  const lastUrl = joinUrl(baseUrl, options.lastPath);
  const listUrl = joinUrl(baseUrl, options.listPath);
  const call = (url: string) => context.with(options.parentContext ?? context.active(), () => options.fetchImpl(url, {
    headers: tracedHeaders(options.traceId, options.parentContext),
    signal: AbortSignal.timeout(5000),
  }));

  try {
    const response = await call(lastUrl);

    if (response.ok) {
      return { status: 'ok', source: lastUrl, data: pickLast(await response.json()) };
    }
  } catch {
    // try list fallback
  }

  try {
    const response = await call(listUrl);

    if (!response.ok) {
      return { status: 'failed', source: listUrl, error: `HTTP ${response.status}` };
    }

    return { status: 'ok', source: listUrl, data: pickLast(await response.json()) };
  } catch (error) {
    return {
      status: 'failed',
      source: lastUrl,
      error: error instanceof Error ? error.message : 'request failed',
    };
  }
}

export async function fetchDocument(options: {
  url: string;
  traceId: string;
  parentContext?: Context;
  fetchImpl: FetchLike;
}): Promise<{ status: 'ok' | 'failed'; data?: unknown; error?: string }> {
  try {
    const response = await context.with(options.parentContext ?? context.active(), () => options.fetchImpl(options.url, {
      headers: tracedHeaders(options.traceId, options.parentContext),
      signal: AbortSignal.timeout(5000),
    }));

    if (!response.ok) {
      return { status: 'failed', error: `HTTP ${response.status}` };
    }

    return { status: 'ok', data: await response.json() };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'request failed',
    };
  }
}

export function readRecordId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const body = data as Record<string, unknown>;
  if (body.id !== undefined && body.id !== null && String(body.id).trim()) {
    return String(body.id);
  }
  if (body.local && typeof body.local === 'object') {
    const id = (body.local as Record<string, unknown>).id;
    if (id !== undefined && id !== null && String(id).trim()) return String(id);
  }
  return undefined;
}
