import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { getSupabaseClient } from '../db/client';
import { PokemonRecord } from '../db/schemas/pokemon';

interface PokemonBody {
  nombre: string;
  tipo: string;
  nivel?: number;
}

export async function pokemonRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  app.post<{ Body: PokemonBody }>('/pokemon', async (request, reply) => {
    const { nombre, tipo, nivel = 1 } = request.body;

    if (!nombre || !tipo) {
      return reply.status(400).send({ error: 'nombre and tipo are required' });
    }

    const supabase = supabaseClient ?? getSupabaseClient(env);
    const payload: PokemonRecord = { nombre, tipo, nivel };

    const { data, error } = await supabase
      .from('pokemon')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(201).send(data);
  });
}
