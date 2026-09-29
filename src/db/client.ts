import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';
import { createPgClient } from './pg-client';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(env: AppEnv): SupabaseClient {
  if (env.DATABASE_URL) {
    return createPgClient(env.DATABASE_URL) as unknown as SupabaseClient;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}

export function resetSupabaseClient(): void {
  supabaseClient = null;
}
