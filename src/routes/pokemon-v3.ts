import { FastifyInstance } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { API_V3_PREFIX } from '../config/version';
import { FetchLike } from '../integrations/peer-client';
import { POKEMON_APODO_MAX, POKEMON_V3_COLUMNS } from '../db/schemas/pokemon';
import { registerRestResource } from './rest';
import { pickColumns, Shape } from './shape';

type Json = Record<string, unknown>;
type Apodo = { ok: true; value: string | null | undefined } | { ok: false; error: string };

const pickV3 = pickColumns(POKEMON_V3_COLUMNS);

export const toPokemonV3: Shape = (row) => {
  const apodo = typeof row.apodo === 'string' && row.apodo.length > 0 ? row.apodo : null;
  return { ...pickV3(row), apodo, nombre_mostrado: apodo ?? row.nombre };
};

export function parseApodo(value: unknown): Apodo {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'apodo must be a string' };

  const apodo = value.trim();
  if (apodo.length > POKEMON_APODO_MAX) {
    return { ok: false, error: `apodo must be at most ${POKEMON_APODO_MAX} characters` };
  }

  return { ok: true, value: apodo.length > 0 ? apodo : null };
}

function withApodo(value: Json, body: Json, fallback: null | undefined) {
  const apodo = parseApodo(body.apodo);
  if (!apodo.ok) return apodo;
  const resolved = apodo.value === undefined ? fallback : apodo.value;
  return { ok: true as const, value: resolved === undefined ? value : { ...value, apodo: resolved } };
}

export async function pokemonV3Routes(
  app: FastifyInstance,
  env: AppEnv,
  supabaseClient?: SupabaseClient,
  path = `${API_V3_PREFIX}/pokemon`,
  fetchImpl?: FetchLike,
): Promise<void> {
  await registerRestResource(app, env, supabaseClient, {
    path,
    table: 'pokemon',
    fetchImpl,
    shape: toPokemonV3,
    parsePost: (body) => {
      if (typeof body.nombre !== 'string' || typeof body.tipo !== 'string') {
        return { ok: false, error: 'nombre and tipo are required' };
      }

      const nivel = typeof body.nivel === 'number' ? body.nivel : 1;
      return withApodo({ nombre: body.nombre, tipo: body.tipo, nivel }, body, undefined);
    },
    parsePut: (body) => {
      if (typeof body.nombre !== 'string' || typeof body.tipo !== 'string' || typeof body.nivel !== 'number') {
        return { ok: false, error: 'nombre, tipo and nivel are required' };
      }

      return withApodo({ nombre: body.nombre, tipo: body.tipo, nivel: body.nivel }, body, null);
    },
    parsePatch: (body) => {
      const value: Json = {};

      if (typeof body.nombre === 'string') value.nombre = body.nombre;
      if (typeof body.tipo === 'string') value.tipo = body.tipo;
      if (typeof body.nivel === 'number') value.nivel = body.nivel;

      const parsed = withApodo(value, body, undefined);
      if (!parsed.ok) return parsed;

      if (Object.keys(parsed.value).length === 0) {
        return { ok: false, error: 'at least one of nombre, apodo, tipo, nivel is required' };
      }

      return parsed;
    },
  });
}
