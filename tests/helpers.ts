import { vi } from 'vitest';
import { AppEnv } from '../src/config/env';
import { SupabaseClient } from '@supabase/supabase-js';

export const mockEnv: AppEnv = {
  PORT: 3000,
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
  SUPABASE_SECRET_KEY: 'test-secret-key',
  SUPABASE_JWKS_URL: 'https://test.supabase.co/auth/v1/.well-known/jwks.json',
};

export function createInsertClient(result: unknown, error: { message: string } | null = null): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: result, error }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

export function createSelectClient(result: unknown[], error: { message: string } | null = null): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: result, error }),
      }),
    }),
  } as unknown as SupabaseClient;
}
