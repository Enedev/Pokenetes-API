import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createInsertClient } from './helpers';

describe('POST /batalla', () => {
  it('creates a batalla record', async () => {
    const created = {
      id: 'batalla-1',
      pokemon_id: 'pokemon-1',
      entrenador_id: 'entrenador-1',
      resultado: 'victoria',
    };

    const app = await buildApp(mockEnv, createInsertClient(created));
    const response = await app.inject({
      method: 'POST',
      url: '/batalla',
      payload: {
        pokemon_id: 'pokemon-1',
        entrenador_id: 'entrenador-1',
        resultado: 'victoria',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
  });

  it('returns 400 when required ids are missing', async () => {
    const app = await buildApp(mockEnv, createInsertClient(null));
    const response = await app.inject({
      method: 'POST',
      url: '/batalla',
      payload: { pokemon_id: 'pokemon-1' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'pokemon_id and entrenador_id are required' });
  });

  it('returns 500 when supabase insert fails', async () => {
    const app = await buildApp(mockEnv, createInsertClient(null, { message: 'insert failed' }));
    const response = await app.inject({
      method: 'POST',
      url: '/batalla',
      payload: { pokemon_id: 'p1', entrenador_id: 'e1' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'insert failed' });
  });
});
