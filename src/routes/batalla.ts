import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { getSupabaseClient } from '../db/client';
import { BatallaRecord } from '../db/schemas/batalla';

interface BatallaBody {
  pokemon_id: string;
  entrenador_id: string;
  resultado?: string;
}

export async function batallaRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  app.post<{ Body: BatallaBody }>('/batalla', async (request, reply) => {
    const { pokemon_id, entrenador_id, resultado } = request.body;

    if (!pokemon_id || !entrenador_id) {
      return reply.status(400).send({ error: 'pokemon_id and entrenador_id are required' });
    }

    const supabase = supabaseClient ?? getSupabaseClient(env);
    const payload: BatallaRecord = { pokemon_id, entrenador_id, resultado };

    const { data, error } = await supabase
      .from('batalla')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(201).send(data);
  });
}
