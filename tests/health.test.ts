import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv } from './helpers';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const app = await buildApp(mockEnv);
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', environment: 'test' });
  });
});
