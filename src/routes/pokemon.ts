import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { registerRestResource } from './rest';

export async function pokemonRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  await registerRestResource(app, env, supabaseClient, {
    path: '/pokemon',
    table: 'pokemon',
    parsePost: (body) => {
      const nombre = body.nombre;
      const tipo = body.tipo;

      if (typeof nombre !== 'string' || typeof tipo !== 'string') {
        return { ok: false, error: 'nombre and tipo are required' };
      }

      return {
        ok: true,
        value: { nombre, tipo, nivel: typeof body.nivel === 'number' ? body.nivel : 1 },
      };
    },
    parsePut: (body) => {
      const nombre = body.nombre;
      const tipo = body.tipo;
      const nivel = body.nivel;

      if (typeof nombre !== 'string' || typeof tipo !== 'string' || typeof nivel !== 'number') {
        return { ok: false, error: 'nombre, tipo and nivel are required' };
      }

      return { ok: true, value: { nombre, tipo, nivel } };
    },
    parsePatch: (body) => {
      const value: Record<string, unknown> = {};

      if (typeof body.nombre === 'string') value.nombre = body.nombre;
      if (typeof body.tipo === 'string') value.tipo = body.tipo;
      if (typeof body.nivel === 'number') value.nivel = body.nivel;

      if (Object.keys(value).length === 0) {
        return { ok: false, error: 'at least one of nombre, tipo, nivel is required' };
      }

      return { ok: true, value };
    },
  });
}
