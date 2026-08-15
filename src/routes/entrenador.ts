import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { getSupabaseClient } from '../db/client';
import { EntrenadorRecord } from '../db/schemas/entrenador';

interface EntrenadorBody {
  nombre: string;
  region?: string;
}

export async function entrenadorRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  app.post<{ Body: EntrenadorBody }>('/entrenador', async (request, reply) => {
    const { nombre, region } = request.body;

    if (!nombre) {
      return reply.status(400).send({ error: 'nombre is required' });
    }

    const supabase = supabaseClient ?? getSupabaseClient(env);
    const payload: EntrenadorRecord = { nombre, region };

    const { data, error } = await supabase
      .from('entrenador')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.status(201).send(data);
  });
}
