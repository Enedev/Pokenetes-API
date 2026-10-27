import type { FastifyInstance } from 'fastify';
import type { Track } from '../config/release';
import { apiVersionOf } from '../http/release';
import { EmfMetrics, emitMetrics } from './emf';

const UNTRACKED_ROUTES = new Set(['/health']);

export function isPokemonCreated(method: string, route: string, status: number): boolean {
  return method === 'POST' && status === 201 && /(^|\/)pokemon$/.test(route);
}

export function recordRequestMetrics(app: FastifyInstance, track: Track): void {
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url ?? request.url;
    if (UNTRACKED_ROUTES.has(route)) return;

    const status = reply.statusCode;
    const metrics: EmfMetrics = {
      Requests: { value: 1, unit: 'Count' },
      Latency: { value: Math.round(reply.elapsedTime * 100) / 100, unit: 'Milliseconds' },
      Errors5xx: { value: status >= 500 ? 1 : 0, unit: 'Count' },
      Errors4xx: { value: status >= 400 && status < 500 ? 1 : 0, unit: 'Count' },
    };

    if (isPokemonCreated(request.method, route, status)) {
      metrics.PokemonCreated = { value: 1, unit: 'Count' };
    }

    emitMetrics(track, metrics, {
      route,
      method: request.method,
      status,
      api: apiVersionOf(request.url),
    });
  });
}
