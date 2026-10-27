import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { contractVersionOf } from '../config/version';
import { getSupabaseClient } from '../db/client';
import { apiVersionOf } from '../http/release';
import { v2TraceFields } from '../http/trace';
import { FetchLike, fetchConfiguredPeers } from '../integrations/peer-client';
import { applyShape, Shape } from './shape';

type Json = Record<string, unknown>;

type ParseResult =
  | { ok: true; value: Json }
  | { ok: false; error: string };

export interface RestResourceConfig {
  path: string;
  table: string;
  parsePost: (body: Json) => ParseResult;
  parsePut: (body: Json) => ParseResult;
  parsePatch: (body: Json) => ParseResult;
  fetchImpl?: FetchLike;
  shape?: Shape;
}

export async function registerRestResource(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient: SupabaseClient | undefined,
  config: RestResourceConfig,
): Promise<void> {
  const db = () => supabaseClient ?? getSupabaseClient(env);
  const notFound = { error: `${config.table} not found` };
  const shaped = (data: unknown) => applyShape(data, config.shape);
  const version = contractVersionOf(apiVersionOf(config.path));

  app.get(config.path, async (_request, reply) => {
    const { data, error } = await db().from(config.table).select('*');

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(200).send(shaped(data));
  });

  app.get<{ Params: { id: string } }>(`${config.path}/:id`, async (request, reply) => {
    const { data, error } = await db()
      .from(config.table)
      .select('*')
      .eq('id', request.params.id)
      .single();

    if (error || !data) {
      return reply.status(404).send(notFound);
    }

    if (!config.path.startsWith('/api/')) {
      return reply.status(200).send(shaped(data));
    }

    const trace = v2TraceFields(request);
    const peers = await fetchConfiguredPeers(env, trace['x-trace_id'], config.fetchImpl);

    return reply.status(200).send({
      api: 'pokenetes',
      version,
      ...trace,
      entity: config.table,
      local: shaped(data),
      peers,
    });
  });

  app.post<{ Body: Json }>(config.path, async (request, reply) => {
    const parsed = config.parsePost(request.body ?? {});

    if (!parsed.ok) {
      return reply.status(400).send({ error: parsed.error });
    }

    const { data, error } = await db()
      .from(config.table)
      .insert(parsed.value)
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(201).send(shaped(data));
  });

  app.put<{ Params: { id: string }; Body: Json }>(`${config.path}/:id`, async (request, reply) => {
    const parsed = config.parsePut(request.body ?? {});

    if (!parsed.ok) {
      return reply.status(400).send({ error: parsed.error });
    }

    const { data, error } = await db()
      .from(config.table)
      .update(parsed.value)
      .eq('id', request.params.id)
      .select()
      .single();

    if (error || !data) {
      return reply.status(404).send(notFound);
    }

    return reply.status(200).send(shaped(data));
  });

  app.patch<{ Params: { id: string }; Body: Json }>(`${config.path}/:id`, async (request, reply) => {
    const parsed = config.parsePatch(request.body ?? {});

    if (!parsed.ok) {
      return reply.status(400).send({ error: parsed.error });
    }

    const { data, error } = await db()
      .from(config.table)
      .update(parsed.value)
      .eq('id', request.params.id)
      .select()
      .single();

    if (error || !data) {
      return reply.status(404).send(notFound);
    }

    return reply.status(200).send(shaped(data));
  });

  app.delete<{ Params: { id: string } }>(`${config.path}/:id`, async (request, reply) => {
    const { data, error } = await db()
      .from(config.table)
      .delete()
      .eq('id', request.params.id)
      .select()
      .single();

    if (error || !data) {
      return reply.status(404).send(notFound);
    }

    return reply.status(204).send();
  });

  app.route<{ Body: { limit?: number } }>({
    method: 'QUERY',
    url: config.path,
    handler: async (request, reply) => {
      const limit = request.body?.limit ?? 10;
      const { data, error } = await db().from(config.table).select('*').limit(limit);

      if (error) {
        return reply.status(500).send({ error: error.message });
      }

      return reply.status(200).send({
        entity: config.table,
        count: data?.length ?? 0,
        data: shaped(data),
      });
    },
  });
}
