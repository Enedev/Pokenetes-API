import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient, resetSupabaseClient } from '../src/db/client';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe('getSupabaseClient', () => {
  beforeEach(() => {
    resetSupabaseClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSupabaseClient();
  });

  const env = {
    PORT: 3000,
    NODE_ENV: 'test',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'pub',
    SUPABASE_SECRET_KEY: 'secret',
    SUPABASE_JWKS_URL: 'https://example.supabase.co/jwks.json',
  };

  it('creates a singleton supabase client', () => {
    const first = getSupabaseClient(env);
    const second = getSupabaseClient(env);

    expect(first).toBe(second);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it('resets the singleton so a new client can be created', () => {
    getSupabaseClient(env);
    resetSupabaseClient();
    getSupabaseClient(env);

    expect(createClient).toHaveBeenCalledTimes(2);
  });
});
