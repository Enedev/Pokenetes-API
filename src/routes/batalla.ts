import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { registerRestResource } from './rest';

export async function batallaRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  await registerRestResource(app, env, supabaseClient, {
    path: '/batalla',
    table: 'batalla',
    parsePost: (body) => {
      if (typeof body.pokemon_id !== 'string' || typeof body.entrenador_id !== 'string') {
        return { ok: false, error: 'pokemon_id and entrenador_id are required' };
      }

      return {
        ok: true,
        value: {
          pokemon_id: body.pokemon_id,
          entrenador_id: body.entrenador_id,
          resultado: typeof body.resultado === 'string' ? body.resultado : undefined,
        },
      };
    },
    parsePut: (body) => {
      if (typeof body.pokemon_id !== 'string' || typeof body.entrenador_id !== 'string') {
        return { ok: false, error: 'pokemon_id and entrenador_id are required' };
      }

      return {
        ok: true,
        value: {
          pokemon_id: body.pokemon_id,
          entrenador_id: body.entrenador_id,
          resultado: typeof body.resultado === 'string' ? body.resultado : null,
        },
      };
    },
    parsePatch: (body) => {
      const value: Record<string, unknown> = {};

      if (typeof body.pokemon_id === 'string') value.pokemon_id = body.pokemon_id;
      if (typeof body.entrenador_id === 'string') value.entrenador_id = body.entrenador_id;
      if (typeof body.resultado === 'string') value.resultado = body.resultado;

      if (Object.keys(value).length === 0) {
        return { ok: false, error: 'at least one of pokemon_id, entrenador_id, resultado is required' };
      }

      return { ok: true, value };
    },
  });
}
