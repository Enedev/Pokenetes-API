import { randomUUID } from 'crypto';
import { context, propagation, trace } from '@opentelemetry/api';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { OrchestratorEnv } from './config/env';
import { requestContext, observeRequests } from './http';
import { ConfiguredSqsQueue, MemoryQueue } from './queue';
import { runSaga } from './saga';
import { getFlujo, listFlujos, saveFlujo } from './store';
import { FetchLike, FlujoEntry, FlujoMessage } from './types';

const ENTITIES = ['pokemon', 'entrenador', 'batalla'] as const;

export async function buildOrchestratorApp(env: OrchestratorEnv, fetchImpl: FetchLike = fetch) {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });
  observeRequests(app);
  const memory = new MemoryQueue(async (message) => {
    await runSaga(message, env, fetchImpl);
  });
  const queue = new ConfiguredSqsQueue(env.AWS_SQS_QUEUE_URL ?? '', memory);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'pokenetes-orchestrator',
    environment: env.NODE_ENV,
    queue: env.AWS_SQS_QUEUE_URL ? 'sqs' : 'memory',
  }));

  const startFlujo = async (
    request: FastifyRequest,
    reply: FastifyReply,
    entry?: FlujoEntry,
  ) => {
    const body = (request.body ?? {}) as { entity?: string; trace_id?: string };
    const query = (request.query ?? {}) as { entity?: string };
    const requested = body.entity ?? query.entity ?? 'pokemon';

    if ((!entry || entry === 'aws') && !ENTITIES.includes(requested as (typeof ENTITIES)[number])) {
      return reply.status(400).send({
        error: 'entity must be pokemon, entrenador or batalla',
      });
    }

    const entity = entry === 'azure'
      ? 'book'
      : entry === 'gcp'
        ? 'hospital'
        : requested as (typeof ENTITIES)[number];
    const incoming = request.headers['x-trace-id'];
    const traceId =
      (typeof incoming === 'string' && incoming.trim()) ||
      body.trace_id ||
      randomUUID();
    request.headers['x-trace-id'] = traceId;

    const saved = await context.with(requestContext(request), async () => {
      const carrier: Record<string, string> = {};
      propagation.inject(context.active(), carrier);
      const otelTraceId = trace.getActiveSpan()?.spanContext().traceId;
      const message: FlujoMessage = {
        trace_id: traceId,
        otel_trace_id: otelTraceId && !/^0+$/.test(otelTraceId) ? otelTraceId : undefined,
        traceparent: carrier.traceparent,
        entry,
        entity,
        status: 'pending',
        steps: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveFlujo(message);
      await queue.enqueue(message);
      return message;
    });

    const finished = entry ? await waitUntilSettled(traceId) : await getFlujo(traceId);
    return reply.status(entry ? 200 : 202).header('x-trace-id', traceId).send(finished ?? saved);
  };

  const waitUntilSettled = async (traceId: string) => {
    const deadline = Date.now() + 20000;
    let found = await getFlujo(traceId);
    while (found && (found.status === 'pending' || found.status === 'running') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      found = await getFlujo(traceId);
    }
    return found;
  };

  app.post<{ Body: { entity?: string; trace_id?: string } }>('/api/v2/flujo', async (request, reply) => startFlujo(request, reply));
  app.post<{ Body: { entity?: string; trace_id?: string } }>('/api/v2/flujo-aws', async (request, reply) => startFlujo(request, reply, 'aws'));
  app.post<{ Body: { entity?: string; trace_id?: string } }>('/api/v2/flujo-azure', async (request, reply) => startFlujo(request, reply, 'azure'));
  app.post<{ Body: { entity?: string; trace_id?: string } }>('/api/v2/flujo-gcp', async (request, reply) => startFlujo(request, reply, 'gcp'));
  app.get<{ Querystring: { entity?: string } }>('/api/v2/flujo-aws', async (request, reply) => startFlujo(request, reply, 'aws'));
  app.get<{ Querystring: { entity?: string } }>('/api/v2/flujo-azure', async (request, reply) => startFlujo(request, reply, 'azure'));
  app.get<{ Querystring: { entity?: string } }>('/api/v2/flujo-gcp', async (request, reply) => startFlujo(request, reply, 'gcp'));

  app.get<{ Params: { traceId: string } }>('/api/v2/flujo/:traceId', async (request, reply) => {
    const found = await getFlujo(request.params.traceId);

    if (!found) {
      return reply.status(404).send({ error: 'flujo not found' });
    }

    return reply.status(200).header('x-trace-id', found.trace_id).send(found);
  });

  app.get('/api/v2/flujo', async () => listFlujos());

  return app;
}
