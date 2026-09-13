import dotenv from 'dotenv';
import path from 'path';

export interface AppEnv {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_JWKS_URL: string;
  DATABASE_URL?: string;
  BIBLIO_API_URL?: string;
  BIBLIO_LAST_PATH: string;
  BIBLIO_LIST_PATH: string;
  HOSPITALINE_API_URL?: string;
  HOSPITALINE_LAST_PATH: string;
  HOSPITALINE_LIST_PATH: string;
}

function resolveEnvFile(): string {
  const nodeEnv = process.env.NODE_ENV ?? 'test';

  if (nodeEnv === 'production') {
    return path.resolve(process.cwd(), '.env.prod');
  }

  return path.resolve(process.cwd(), '.env.test');
}

export function loadEnv(): AppEnv {
  const envFile = resolveEnvFile();
  dotenv.config({ path: envFile });

  const required = [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_JWKS_URL',
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    PORT: Number(process.env.PORT ?? 3000),
    NODE_ENV: process.env.NODE_ENV ?? 'test',
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY!,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
    SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL!,
    DATABASE_URL: process.env.DATABASE_URL,
    BIBLIO_API_URL: process.env.BIBLIO_API_URL,
    BIBLIO_LAST_PATH: process.env.BIBLIO_LAST_PATH ?? '/api/v2/books/last',
    BIBLIO_LIST_PATH: process.env.BIBLIO_LIST_PATH ?? '/api/books',
    HOSPITALINE_API_URL: process.env.HOSPITALINE_API_URL,
    HOSPITALINE_LAST_PATH: process.env.HOSPITALINE_LAST_PATH ?? '/api/v2/hospitals/last',
    HOSPITALINE_LIST_PATH: process.env.HOSPITALINE_LIST_PATH ?? '/api/v1/hospitals',
  };
}
