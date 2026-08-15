import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { getSupabaseClient } from '../db/client';

interface QueryBody {
  entity: 'pokemon' | 'entrenador' | 'batalla';
  limit?: number;
}

const ALLOWED_ENTITIES = ['pokemon', 'entrenador', 'batalla'] as const;

export async function queryRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  app.route<{ Body: QueryBody }>({
    method: 'QUERY',
    url: '/query',
    handler: async (request, reply) => {
      const { entity, limit = 10 } = request.body ?? {};

      if (!entity || !ALLOWED_ENTITIES.includes(entity)) {
        return reply.status(400).send({
          error: 'entity is required and must be one of: pokemon, entrenador, batalla',
        });
      }

      const supabase = supabaseClient ?? getSupabaseClient(env);
      const { data, error } = await supabase.from(entity).select('*').limit(limit);

      if (error) {
        return reply.status(500).send({ error: error.message });
      }

      return reply.status(200).send({ entity, count: data?.length ?? 0, data });
    },
  });
}
