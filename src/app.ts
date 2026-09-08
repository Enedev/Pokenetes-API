import Fastify from 'fastify';
import { AppEnv } from './config/env';
import { runMigrations } from './db/migrate';
import { pokemonRoutes } from './routes/pokemon';
import { entrenadorRoutes } from './routes/entrenador';
import { batallaRoutes } from './routes/batalla';
import { queryRoutes } from './routes/query';

export async function buildApp(env: AppEnv, supabase?: ReturnType<typeof import('./db/client').getSupabaseClient>) {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' });

  app.get('/', async () => ({
    name: 'Pokenetes API',
    status: 'ok',
    environment: env.NODE_ENV,
    endpoints: {
      health: 'GET /health',
      pokemon: 'GET|POST|PUT|PATCH|DELETE|HEAD|QUERY /pokemon',
      entrenador: 'GET|POST|PUT|PATCH|DELETE|HEAD|QUERY /entrenador',
      batalla: 'GET|POST|PUT|PATCH|DELETE|HEAD|QUERY /batalla',
      query: 'QUERY /query',
    },
  }));

  app.get('/health', async () => ({
    status: 'ok',
    environment: env.NODE_ENV,
  }));

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
