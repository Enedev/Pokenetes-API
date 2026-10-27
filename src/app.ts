import Fastify, { FastifyInstance } from 'fastify';
import { AppEnv } from './config/env';
import {
  ApiContract,
  API_VERSION,
  API_V2_PREFIX,
  API_V3_PREFIX,
  APP_VERSION,
  PUBLIC_API_PREFIX,
  PUBLIC_API_VERSION,
} from './config/version';
import { resolveTrack } from './config/release';
import { runMigrations } from './db/migrate';
import { observeRequests, resolveTraceId } from './http/trace';
import { tagResponses } from './http/release';
import { recordRequestMetrics } from './metrics/requests';
import { startSaturationSampler } from './metrics/saturation';
import { pokemonRoutes } from './routes/pokemon';
import { pokemonV3Routes, toPokemonV3 } from './routes/pokemon-v3';
import { entrenadorRoutes } from './routes/entrenador';
import { batallaRoutes } from './routes/batalla';
import { queryRoutes } from './routes/query';
import { lastRoutes } from './routes/last';
import { FetchLike } from './integrations/peer-client';

type Db = ReturnType<typeof import('./db/client').getSupabaseClient>;

async function mountContract(
  app: FastifyInstance,
  env: AppEnv,
  supabase: Db | undefined,
  fetchImpl: FetchLike | undefined,
  prefix: string,
  contract: ApiContract,
) {
  if (contract === 'v3') {
    await lastRoutes(app, env, supabase, prefix, { pokemon: toPokemonV3 });
    await pokemonV3Routes(app, env, supabase, `${prefix}/pokemon`, fetchImpl);
  } else {
    await lastRoutes(app, env, supabase, prefix);
    await pokemonRoutes(app, env, supabase, `${prefix}/pokemon`, fetchImpl);
  }

  await entrenadorRoutes(app, env, supabase, `${prefix}/entrenador`, fetchImpl);
  await batallaRoutes(app, env, supabase, `${prefix}/batalla`, fetchImpl);
}

export async function buildApp(
  env: AppEnv,
  supabase?: ReturnType<typeof import('./db/client').getSupabaseClient>,
  fetchImpl?: FetchLike,
) {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });
  const track = resolveTrack(env.APP_TRACK);
  tagResponses(app, track);
  recordRequestMetrics(app, track);

  app.addHook('onRequest', async (request) => {
    request.headers['x-trace-id'] = resolveTraceId(request.headers['x-trace-id']);
  });
  observeRequests(app);

  app.get('/', async () => ({
    name: 'Pokenetes API',
    status: 'ok',
    version: API_VERSION,
    environment: env.NODE_ENV,
    endpoints: {
      health: 'GET /health',
      v1: {
        pokemon: 'GET|POST|PUT|PATCH|DELETE|HEAD|QUERY /pokemon',
        entrenador: 'GET|POST|PUT|PATCH|DELETE|HEAD|QUERY /entrenador',
        batalla: 'GET|POST|PUT|PATCH|DELETE|HEAD|QUERY /batalla',
        query: 'QUERY /query',
      },
      v2: {
        pokemon: `GET|POST|PUT|PATCH|DELETE|HEAD|QUERY ${API_V2_PREFIX}/pokemon`,
        entrenador: `GET|POST|PUT|PATCH|DELETE|HEAD|QUERY ${API_V2_PREFIX}/entrenador`,
        batalla: `GET|POST|PUT|PATCH|DELETE|HEAD|QUERY ${API_V2_PREFIX}/batalla`,
        last: `GET ${API_V2_PREFIX}/{pokemon|entrenador|batalla}/last`,
        getById: `GET ${API_V2_PREFIX}/{pokemon|entrenador|batalla}/:id`,
        query: `QUERY ${API_V2_PREFIX}/query`,
      },
      v3: {
        pokemon: `GET|POST|PUT|PATCH|DELETE ${API_V3_PREFIX}/pokemon (apodo, nombre_mostrado)`,
        entrenador: `GET|POST|PUT|PATCH|DELETE ${API_V3_PREFIX}/entrenador`,
        batalla: `GET|POST|PUT|PATCH|DELETE ${API_V3_PREFIX}/batalla`,
        last: `GET ${API_V3_PREFIX}/{pokemon|entrenador|batalla}/last`,
      },
      public: {
        serves: PUBLIC_API_VERSION,
        pokemon: `GET|POST|PUT|PATCH|DELETE ${PUBLIC_API_PREFIX}/pokemon`,
        entrenador: `GET|POST|PUT|PATCH|DELETE ${PUBLIC_API_PREFIX}/entrenador`,
        batalla: `GET|POST|PUT|PATCH|DELETE ${PUBLIC_API_PREFIX}/batalla`,
        last: `GET ${PUBLIC_API_PREFIX}/{pokemon|entrenador|batalla}/last`,
      },
    },
  }));

  app.get('/health', async () => ({
    status: 'ok',
    version: API_VERSION,
    app_version: APP_VERSION,
    track,
    environment: env.NODE_ENV,
  }));

  await mountContract(app, env, supabase, fetchImpl, API_V2_PREFIX, 'v2');
  await queryRoutes(app, env, supabase, `${API_V2_PREFIX}/query`);
  await mountContract(app, env, supabase, fetchImpl, API_V3_PREFIX, 'v3');
  await mountContract(app, env, supabase, fetchImpl, PUBLIC_API_PREFIX, PUBLIC_API_VERSION);
  await pokemonRoutes(app, env, supabase);
  await entrenadorRoutes(app, env, supabase);
  await batallaRoutes(app, env, supabase);
  await queryRoutes(app, env, supabase);

  return app;
}

export async function startServer(env: AppEnv) {
  await runMigrations(env);

  const app = await buildApp(env);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  startSaturationSampler(resolveTrack(env.APP_TRACK));

  return app;
}
