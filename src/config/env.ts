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
  APP_TRACK?: string;
  FAULT_LATENCY_MS?: string;
  FAULT_ERROR_RATE?: string;
  FAULT_TOKEN?: string;
  PEER_LATENCY_MS?: string;
  PEER_RESILIENCE?: string;
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
    BIBLIO_LAST_PATH: process.env.BIBLIO_LAST_PATH ?? '/api/v5/books/last',
    BIBLIO_LIST_PATH: process.env.BIBLIO_LIST_PATH ?? '/api/v5/books',
    HOSPITALINE_API_URL: process.env.HOSPITALINE_API_URL,
    HOSPITALINE_LAST_PATH: process.env.HOSPITALINE_LAST_PATH ?? '/api/v5/hospitals/last',
    HOSPITALINE_LIST_PATH: process.env.HOSPITALINE_LIST_PATH ?? '/api/v5/hospitals',
    APP_TRACK: process.env.APP_TRACK,
    FAULT_LATENCY_MS: process.env.FAULT_LATENCY_MS,
    FAULT_ERROR_RATE: process.env.FAULT_ERROR_RATE,
    FAULT_TOKEN: process.env.FAULT_TOKEN,
    PEER_LATENCY_MS: process.env.PEER_LATENCY_MS,
    PEER_RESILIENCE: process.env.PEER_RESILIENCE,
  };
}
