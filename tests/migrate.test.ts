import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn().mockResolvedValue({ rows: [] });
const connectMock = vi.fn().mockResolvedValue(undefined);
const endMock = vi.fn().mockResolvedValue(undefined);

vi.mock('pg', () => {
  class Client {
    connect = connectMock;
    query = queryMock;
    end = endMock;
  }

  return { default: { Client } };
});

const selectMock = vi.fn();
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock('../src/db/client', () => ({
  getSupabaseClient: vi.fn(() => ({ from: fromMock })),
}));

describe('runMigrations', () => {
  beforeEach(() => {
    queryMock.mockClear();
    connectMock.mockClear();
    endMock.mockClear();
    fromMock.mockClear();
    selectMock.mockReset();
  });

  it('applies DDL when DATABASE_URL is provided', async () => {
    const { runMigrations } = await import('../src/db/migrate');

    await runMigrations({
      PORT: 3000,
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'pub',
      SUPABASE_SECRET_KEY: 'secret',
      SUPABASE_JWKS_URL: 'https://example.supabase.co/jwks.json',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    });

    expect(connectMock).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(endMock).toHaveBeenCalled();
  });

  it('verifies tables via supabase when DATABASE_URL is missing', async () => {
    selectMock.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { runMigrations } = await import('../src/db/migrate');

    await runMigrations({
      PORT: 3000,
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'pub',
      SUPABASE_SECRET_KEY: 'secret',
      SUPABASE_JWKS_URL: 'https://example.supabase.co/jwks.json',
    });

    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it('throws when a table is not accessible', async () => {
    selectMock.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'relation missing' } }),
    });

    const { runMigrations } = await import('../src/db/migrate');

    await expect(
      runMigrations({
        PORT: 3000,
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'pub',
        SUPABASE_SECRET_KEY: 'secret',
        SUPABASE_JWKS_URL: 'https://example.supabase.co/jwks.json',
      }),
    ).rejects.toThrow('is not accessible');
  });
});
