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
  BIBLIO_API_URL: 'https://biblio.example.test',
  BIBLIO_LAST_PATH: '/api/v2/books/last',
  BIBLIO_LIST_PATH: '/api/books',
  HOSPITALINE_API_URL: 'https://hospitaline.example.test',
  HOSPITALINE_LAST_PATH: '/api/v2/hospitals/last',
  HOSPITALINE_LIST_PATH: '/api/v1/hospitals',
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

export function createCrudClient(
  result: { data?: unknown; error?: { message: string } | null } = {},
): SupabaseClient {
  const payload = { data: result.data ?? null, error: result.error ?? null };

  const createQuery = () => {
    const query: Record<string, unknown> = {};
    const self = () => query;

    query.select = vi.fn(self);
    query.insert = vi.fn(self);
    query.update = vi.fn(self);
    query.delete = vi.fn(self);
    query.eq = vi.fn(self);
    query.order = vi.fn(self);
    query.limit = vi.fn(self);
    query.single = vi.fn(async () => payload);
    query.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(payload).then(resolve, reject);

    return query;
  };

  return {
    from: vi.fn(() => createQuery()),
  } as unknown as SupabaseClient;
}
