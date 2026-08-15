import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createInsertClient } from './helpers';

describe('POST /pokemon', () => {
  it('creates a pokemon record', async () => {
    const created = {
      id: 'pokemon-1',
      nombre: 'Pikachu',
      tipo: 'Electrico',
      nivel: 5,
    };

    const app = await buildApp(mockEnv, createInsertClient(created));
    const response = await app.inject({
      method: 'POST',
      url: '/pokemon',
      payload: { nombre: 'Pikachu', tipo: 'Electrico', nivel: 5 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
  });

  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp(mockEnv, createInsertClient(null));
    const response = await app.inject({
      method: 'POST',
      url: '/pokemon',
      payload: { nombre: 'Pikachu' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'nombre and tipo are required' });
  });

  it('returns 500 when supabase insert fails', async () => {
    const app = await buildApp(mockEnv, createInsertClient(null, { message: 'insert failed' }));
    const response = await app.inject({
      method: 'POST',
      url: '/pokemon',
      payload: { nombre: 'Pikachu', tipo: 'Electrico' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'insert failed' });
  });
});
