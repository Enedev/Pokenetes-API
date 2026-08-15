import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createSelectClient } from './helpers';

describe('QUERY /query', () => {
  it('returns pokemon records using QUERY method', async () => {
    const records = [{ id: '1', nombre: 'Pikachu', tipo: 'Electrico', nivel: 5 }];

    const app = await buildApp(mockEnv, createSelectClient(records));
    const response = await app.inject({
      method: 'QUERY',
      url: '/query',
      payload: { entity: 'pokemon', limit: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entity: 'pokemon', count: 1, data: records });
  });

  it('returns 400 for invalid entity', async () => {
    const app = await buildApp(mockEnv, createSelectClient([]));
    const response = await app.inject({
      method: 'QUERY',
      url: '/query',
      payload: { entity: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'entity is required and must be one of: pokemon, entrenador, batalla',
    });
  });

  it('returns 500 when supabase select fails', async () => {
    const app = await buildApp(mockEnv, createSelectClient([], { message: 'select failed' }));
    const response = await app.inject({
      method: 'QUERY',
      url: '/query',
      payload: { entity: 'pokemon' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'select failed' });
  });

  it('returns 400 when entity is missing', async () => {
    const app = await buildApp(mockEnv, createSelectClient([]));
    const response = await app.inject({
      method: 'QUERY',
      url: '/query',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
