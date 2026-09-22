import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { API_VERSION, API_V2_PREFIX } from '../config/version';
import { getSupabaseClient } from '../db/client';
import { fetchLastLocalRecord } from '../db/last';
import { resolveTraceId } from '../http/trace';

const LOCAL_ENTITIES = ['pokemon', 'entrenador', 'batalla'] as const;

export async function lastRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  const db = () => supabaseClient ?? getSupabaseClient(env);

  for (const entity of LOCAL_ENTITIES) {
    app.get(`${API_V2_PREFIX}/${entity}/last`, async (request, reply) => {
      const traceId = resolveTraceId(request.headers['x-trace-id']);
      const local = await fetchLastLocalRecord(db(), entity);

      if (local.error) {
        return reply.status(500).send({ error: local.error, trace_id: traceId });
      }

      return reply.status(200).send({
        api: 'pokenetes',
        version: API_VERSION,
        trace_id: traceId,
        entity,
        local: local.data,
      });
    });
  }
}
