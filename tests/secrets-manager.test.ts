import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hydrateSecretsFromAws } from '../src/config/secrets-manager';

describe('hydrateSecretsFromAws', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.AWS_SECRETS_MANAGER_SECRET_ID;
    delete process.env.SUPABASE_URL;
  });

  it('does nothing when AWS_SECRETS_MANAGER_SECRET_ID is unset', async () => {
    const send = vi.fn();
    await hydrateSecretsFromAws({ send } as never);
    expect(send).not.toHaveBeenCalled();
  });

  it('copies string keys from Secrets Manager into process.env', async () => {
    vi.stubEnv('AWS_SECRETS_MANAGER_SECRET_ID', 'pokenetes/test');
    const send = vi.fn().mockResolvedValue({
      SecretString: JSON.stringify({ SUPABASE_URL: 'https://sm.example.supabase.co' }),
    });

    await hydrateSecretsFromAws({ send } as never);

    expect(send).toHaveBeenCalledTimes(1);
    expect(process.env.SUPABASE_URL).toBe('https://sm.example.supabase.co');
  });
});
