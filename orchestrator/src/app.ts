import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import { OrchestratorEnv } from './config/env';
import { ConfiguredSqsQueue, MemoryQueue } from './queue';
import { runSaga } from './saga';
import { getFlujo, listFlujos, saveFlujo } from './store';
import { FetchLike, FlujoMessage } from './types';

const ENTITIES = ['pokemon', 'entrenador', 'batalla'] as const;

export async function buildOrchestratorApp(env: OrchestratorEnv, fetchImpl: FetchLike = fetch) {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });
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

  app.post<{ Body: { entity?: string; trace_id?: string } }>('/api/v2/flujo', async (request, reply) => {
    const requested = request.body?.entity ?? 'pokemon';

    if (!ENTITIES.includes(requested as (typeof ENTITIES)[number])) {
      return reply.status(400).send({
        error: 'entity must be pokemon, entrenador or batalla',
      });
    }

    const entity = requested as (typeof ENTITIES)[number];

    const incoming = request.headers['x-trace-id'];
    const traceId =
      (typeof incoming === 'string' && incoming.trim()) ||
      request.body?.trace_id ||
      randomUUID();

    const message: FlujoMessage = {
      trace_id: traceId,
      entity,
      status: 'pending',
      steps: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveFlujo(message);
    await queue.enqueue(message);

    return reply.status(202).send(getFlujo(traceId));
  });

  app.get<{ Params: { traceId: string } }>('/api/v2/flujo/:traceId', async (request, reply) => {
    const found = getFlujo(request.params.traceId);

    if (!found) {
      return reply.status(404).send({ error: 'flujo not found' });
    }

    return reply.status(200).send(found);
  });

  app.get('/api/v2/flujo', async () => listFlujos());

  return app;
}
