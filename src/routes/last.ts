import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { API_V2_PREFIX, contractVersionOf } from '../config/version';
import { getSupabaseClient } from '../db/client';
import { fetchLastLocalRecord } from '../db/last';
import { apiVersionOf } from '../http/release';
import { v2TraceFields } from '../http/trace';
import { POKEMON_V2_COLUMNS } from '../db/schemas/pokemon';
import { applyShape, pickColumns, Shape } from './shape';

const LOCAL_ENTITIES = ['pokemon', 'entrenador', 'batalla'] as const;

type LocalEntity = (typeof LOCAL_ENTITIES)[number];

const V2_SHAPES: Partial<Record<LocalEntity, Shape>> = {
  pokemon: pickColumns(POKEMON_V2_COLUMNS),
};

export async function lastRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
  prefix = API_V2_PREFIX,
  shapes: Partial<Record<LocalEntity, Shape>> = V2_SHAPES,
): Promise<void> {
  const db = () => supabaseClient ?? getSupabaseClient(env);
  const version = contractVersionOf(apiVersionOf(prefix));

  for (const entity of LOCAL_ENTITIES) {
    app.get(`${prefix}/${entity}/last`, async (request, reply) => {
      const local = await fetchLastLocalRecord(db(), entity);
      const trace = v2TraceFields(request);

      if (local.error) {
        return reply.status(500).send({ error: local.error, ...trace });
      }

      return reply.status(200).send({
        api: 'pokenetes',
        version,
        ...trace,
        entity,
        local: applyShape(local.data, shapes[entity]),
      });
    });
  }
}
