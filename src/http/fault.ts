import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnv } from '../config/env';
import type { Track } from '../config/release';
import { API_V3_PREFIX } from '../config/version';

export const FAULT_PATH = `${API_V3_PREFIX}/fault`;
export const MAX_FAULT_LATENCY_MS = 10_000;

export interface Fault {
  latencyMs: number;
  errorRate: number;
}

export interface FaultOptions {
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const NO_FAULT: Fault = { latencyMs: 0, errorRate: 0 };

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function parseLatency(value: unknown): number | undefined {
  const ms = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(ms) || ms < 0) return undefined;
  return Math.min(Math.round(ms), MAX_FAULT_LATENCY_MS);
}

export function parseErrorRate(value: unknown): number | undefined {
  const rate = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(rate)) return undefined;
  return Math.min(Math.max(rate, 0), 1);
}

export function faultFromEnv(env: AppEnv): Fault {
  return {
    latencyMs: parseLatency(env.FAULT_LATENCY_MS) ?? 0,
    errorRate: parseErrorRate(env.FAULT_ERROR_RATE) ?? 0,
  };
}

function isExempt(url: string): boolean {
  const path = url.split('?')[0];
  return path === '/health' || path === FAULT_PATH;
}

export function registerFaultInjection(
  app: FastifyInstance,
  env: AppEnv,
  track: Track,
  options: FaultOptions = {},
): void {
  if (track !== 'canary') return;

  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let fault = faultFromEnv(env);

  const authorized = (request: FastifyRequest) => !env.FAULT_TOKEN || header(request, 'x-fault-token') === env.FAULT_TOKEN;

  const denied = (reply: FastifyReply) => reply.status(403).send({ error: 'invalid x-fault-token' });

  const describe = () => ({ track, latency_ms: fault.latencyMs, error_rate: fault.errorRate });

  app.addHook('onRequest', async (request, reply) => {
    if (isExempt(request.url)) return;

    const fromHeaders = authorized(request);
    const latencyMs = (fromHeaders && parseLatency(header(request, 'x-fault-latency-ms'))) || fault.latencyMs;
    const errorRate = (fromHeaders ? parseErrorRate(header(request, 'x-fault-error-rate')) : undefined) ?? fault.errorRate;

    if (latencyMs > 0) await sleep(latencyMs);

    if (errorRate > 0 && random() < errorRate) {
      reply.header('X-Fault-Injected', 'error');
      return reply.status(500).send({ error: 'injected fault', track });
    }

    if (latencyMs > 0) reply.header('X-Fault-Injected', 'latency');
  });

  app.get(FAULT_PATH, async () => describe());

  app.put<{ Body: { latency_ms?: unknown; error_rate?: unknown } }>(FAULT_PATH, async (request, reply) => {
    if (!authorized(request)) return denied(reply);

    fault = {
      latencyMs: parseLatency(request.body?.latency_ms) ?? NO_FAULT.latencyMs,
      errorRate: parseErrorRate(request.body?.error_rate) ?? NO_FAULT.errorRate,
    };
    request.log.warn({ fault }, 'fault injection updated');

    return describe();
  });

  app.delete(FAULT_PATH, async (request, reply) => {
    if (!authorized(request)) return denied(reply);

    fault = { ...NO_FAULT };
    return describe();
  });
}
