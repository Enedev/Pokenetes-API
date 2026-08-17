import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { registerRestResource } from './rest';

export async function entrenadorRoutes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  await registerRestResource(app, env, supabaseClient, {
    path: '/entrenador',
    table: 'entrenador',
    parsePost: (body) => {
      if (typeof body.nombre !== 'string') {
        return { ok: false, error: 'nombre is required' };
      }

      return {
        ok: true,
        value: {
          nombre: body.nombre,
          region: typeof body.region === 'string' ? body.region : undefined,
        },
      };
    },
    parsePut: (body) => {
      if (typeof body.nombre !== 'string') {
        return { ok: false, error: 'nombre is required' };
      }

      return {
        ok: true,
        value: {
          nombre: body.nombre,
          region: typeof body.region === 'string' ? body.region : null,
        },
      };
    },
    parsePatch: (body) => {
      const value: Record<string, unknown> = {};

      if (typeof body.nombre === 'string') value.nombre = body.nombre;
      if (typeof body.region === 'string') value.region = body.region;

      if (Object.keys(value).length === 0) {
        return { ok: false, error: 'at least one of nombre, region is required' };
      }

      return { ok: true, value };
    },
  });
}
