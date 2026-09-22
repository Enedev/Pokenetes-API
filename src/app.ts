import Fastify from 'fastify';
import { AppEnv } from './config/env';
import { API_VERSION, API_V2_PREFIX } from './config/version';
import { runMigrations } from './db/migrate';
import { resolveTraceId } from './http/trace';
import { pokemonRoutes } from './routes/pokemon';
import { entrenadorRoutes } from './routes/entrenador';
import { batallaRoutes } from './routes/batalla';
import { queryRoutes } from './routes/query';
import { lastRoutes } from './routes/last';
import { FetchLike } from './integrations/peer-client';

export async function buildApp(
  env: AppEnv,
  supabase?: ReturnType<typeof import('./db/client').getSupabaseClient>,
  fetchImpl?: FetchLike,
) {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });

  app.addHook('onRequest', async (request) => {
    request.headers['x-trace-id'] = resolveTraceId(request.headers['x-trace-id']);
  });

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
    },
  }));

  app.get('/health', async () => ({
    status: 'ok',
    version: API_VERSION,
    environment: env.NODE_ENV,
  }));

  await lastRoutes(app, env, supabase);
  await pokemonRoutes(app, env, supabase, `${API_V2_PREFIX}/pokemon`, fetchImpl);
  await entrenadorRoutes(app, env, supabase, `${API_V2_PREFIX}/entrenador`, fetchImpl);
  await batallaRoutes(app, env, supabase, `${API_V2_PREFIX}/batalla`, fetchImpl);
  await queryRoutes(app, env, supabase, `${API_V2_PREFIX}/query`);
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

  return app;
}
