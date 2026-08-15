import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadEnv } from '../src/config/env';
import fs from 'fs';
import path from 'path';

describe('loadEnv', () => {
  const envPath = path.resolve(process.cwd(), '.env.test');

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads environment variables from .env.test', () => {
    if (!fs.existsSync(envPath)) {
      return;
    }

    process.env.NODE_ENV = 'test';
    const env = loadEnv();

    expect(env.PORT).toBe(3000);
    expect(env.SUPABASE_URL).toContain('supabase.co');
  });

  it('throws when required variables are missing', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    vi.stubEnv('SUPABASE_JWKS_URL', '');

    expect(() => loadEnv()).toThrow('Missing required environment variable');
  });

  it('resolves production env file when NODE_ENV is production', () => {
    const prodPath = path.resolve(process.cwd(), '.env.prod');
    if (!fs.existsSync(prodPath)) {
      return;
    }

    process.env.NODE_ENV = 'production';
    const env = loadEnv();
    expect(env.NODE_ENV).toBe('production');
    expect(env.SUPABASE_URL).toContain('supabase.co');
  });
});
