import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createInsertClient } from './helpers';

describe('POST /entrenador', () => {
  it('creates an entrenador record', async () => {
    const created = {
      id: 'entrenador-1',
      nombre: 'Ash',
      region: 'Kanto',
    };

    const app = await buildApp(mockEnv, createInsertClient(created));
    const response = await app.inject({
      method: 'POST',
      url: '/entrenador',
      payload: { nombre: 'Ash', region: 'Kanto' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
  });

  it('returns 400 when nombre is missing', async () => {
    const app = await buildApp(mockEnv, createInsertClient(null));
    const response = await app.inject({
      method: 'POST',
      url: '/entrenador',
      payload: { region: 'Kanto' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'nombre is required' });
  });

  it('returns 500 when supabase insert fails', async () => {
    const app = await buildApp(mockEnv, createInsertClient(null, { message: 'insert failed' }));
    const response = await app.inject({
      method: 'POST',
      url: '/entrenador',
      payload: { nombre: 'Ash' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'insert failed' });
  });
});
