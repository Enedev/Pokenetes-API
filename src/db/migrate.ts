import pg from 'pg';
import { AppEnv } from '../config/env';
import { getSupabaseClient } from './client';
import { POKEMON_APODO_DDL, POKEMON_DDL, POKEMON_TABLE } from './schemas/pokemon';
import { ENTRENADOR_DDL, ENTRENADOR_TABLE } from './schemas/entrenador';
import { BATALLA_DDL, BATALLA_TABLE } from './schemas/batalla';

const MIGRATIONS = [
  { name: POKEMON_TABLE, ddl: POKEMON_DDL },
  { name: ENTRENADOR_TABLE, ddl: ENTRENADOR_DDL },
  { name: BATALLA_TABLE, ddl: BATALLA_DDL },
];

// Expand only: additive and nullable, so the v2 build keeps running against the same table.
const EXPANSIONS = [{ name: `${POKEMON_TABLE}.apodo`, ddl: POKEMON_APODO_DDL }];

async function applyMigrationsWithPg(databaseUrl: string): Promise<void> {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    for (const migration of MIGRATIONS) {
      await client.query(migration.ddl);
      console.log(`[migrate] Applied schema for table: ${migration.name}`);
    }

    for (const expansion of EXPANSIONS) {
      await client.query(expansion.ddl);
      console.log(`[migrate] Expanded schema: ${expansion.name}`);
    }
  } finally {
    await client.end();
  }
}

async function verifyTablesWithSupabase(env: AppEnv): Promise<void> {
  const supabase = getSupabaseClient(env);

  for (const migration of MIGRATIONS) {
    const { error } = await supabase.from(migration.name).select('id').limit(1);

    if (error) {
      throw new Error(
        `[migrate] Table "${migration.name}" is not accessible: ${error.message}. ` +
          'Set DATABASE_URL to enable automatic DDL migrations on startup.',
      );
    }

    console.log(`[migrate] Verified table: ${migration.name}`);
  }
}

export async function runMigrations(env: AppEnv): Promise<void> {
  if (env.DATABASE_URL) {
    await applyMigrationsWithPg(env.DATABASE_URL);
    return;
  }

  console.warn('[migrate] DATABASE_URL not set. Skipping DDL application.');
  await verifyTablesWithSupabase(env);
}
