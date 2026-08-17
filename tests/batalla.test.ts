import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createInsertClient, createCrudClient } from './helpers';

const batalla = {
  id: 'batalla-1',
  pokemon_id: 'pokemon-1',
  entrenador_id: 'entrenador-1',
  resultado: 'victoria',
};

describe('POST /batalla', () => {
  it('creates a batalla record', async () => {
    const app = await buildApp(mockEnv, createInsertClient(batalla));
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
    expect(response.json()).toEqual(batalla);
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

describe('REST /batalla', () => {
  it('lists batallas', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [batalla] }));
    const response = await app.inject({ method: 'GET', url: '/batalla' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([batalla]);
  });

  it('returns one batalla by id', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: batalla }));
    const response = await app.inject({ method: 'GET', url: '/batalla/batalla-1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(batalla);
  });

  it('replaces a batalla with PUT', async () => {
    const updated = { ...batalla, resultado: 'derrota' };
    const app = await buildApp(mockEnv, createCrudClient({ data: updated }));
    const response = await app.inject({
      method: 'PUT',
      url: '/batalla/batalla-1',
      payload: {
        pokemon_id: 'pokemon-1',
        entrenador_id: 'entrenador-1',
        resultado: 'derrota',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
  });

  it('updates a batalla with PATCH', async () => {
    const updated = { ...batalla, resultado: 'empate' };
    const app = await buildApp(mockEnv, createCrudClient({ data: updated }));
    const response = await app.inject({
      method: 'PATCH',
      url: '/batalla/batalla-1',
      payload: { resultado: 'empate' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
  });

  it('deletes a batalla', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: batalla }));
    const response = await app.inject({ method: 'DELETE', url: '/batalla/batalla-1' });

    expect(response.statusCode).toBe(204);
  });

  it('returns headers for HEAD /batalla', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [batalla] }));
    const response = await app.inject({ method: 'HEAD', url: '/batalla' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
  });

  it('queries batalla with QUERY', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [batalla] }));
    const response = await app.inject({
      method: 'QUERY',
      url: '/batalla',
      payload: { limit: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entity: 'batalla', count: 1, data: [batalla] });
  });
});
