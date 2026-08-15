import { describe, it, expect, vi } from 'vitest';
import { startServer } from '../src/app';
import { mockEnv } from './helpers';

vi.mock('../src/db/migrate', () => ({
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));

describe('startServer', () => {
  it('starts listening after running migrations', async () => {
    const app = await startServer({ ...mockEnv, PORT: 0 });
    expect(app.server.listening).toBe(true);
    await app.close();
  });
});
