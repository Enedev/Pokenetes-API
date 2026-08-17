import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { getSupabaseClient } from '../db/client';

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
}

export async function registerRestResource(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient: SupabaseClient | undefined,
  config: RestResourceConfig,
): Promise<void> {
  const db = () => supabaseClient ?? getSupabaseClient(env);
  const notFound = { error: `${config.table} not found` };

  app.get(config.path, async (_request, reply) => {
    const { data, error } = await db().from(config.table).select('*');

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(200).send(data);
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

    return reply.status(200).send(data);
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

    return reply.status(201).send(data);
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

    return reply.status(200).send(data);
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

    return reply.status(200).send(data);
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
        data,
      });
    },
  });
}
