import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(env: AppEnv): SupabaseClient {
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
