import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createInsertClient, createCrudClient } from './helpers';

const pikachu = {
  id: 'pokemon-1',
  nombre: 'Pikachu',
  tipo: 'Electrico',
  nivel: 5,
};

describe('POST /pokemon', () => {
  it('creates a pokemon record', async () => {
    const app = await buildApp(mockEnv, createInsertClient(pikachu));
    const response = await app.inject({
      method: 'POST',
      url: '/pokemon',
      payload: { nombre: 'Pikachu', tipo: 'Electrico', nivel: 5 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(pikachu);
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

describe('GET /pokemon', () => {
  it('lists pokemon records', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [pikachu] }));
    const response = await app.inject({ method: 'GET', url: '/pokemon' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([pikachu]);
  });

  it('returns one pokemon by id', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }));
    const response = await app.inject({ method: 'GET', url: '/pokemon/pokemon-1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(pikachu);
  });

  it('returns 404 when pokemon is missing', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: null, error: { message: 'missing' } }));
    const response = await app.inject({ method: 'GET', url: '/pokemon/missing' });

    expect(response.statusCode).toBe(404);
  });
});

describe('PUT PATCH DELETE HEAD QUERY /pokemon', () => {
  it('replaces a pokemon with PUT', async () => {
    const updated = { ...pikachu, nivel: 10 };
    const app = await buildApp(mockEnv, createCrudClient({ data: updated }));
    const response = await app.inject({
      method: 'PUT',
      url: '/pokemon/pokemon-1',
      payload: { nombre: 'Pikachu', tipo: 'Electrico', nivel: 10 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
  });

  it('returns 400 when PUT is missing fields', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }));
    const response = await app.inject({
      method: 'PUT',
      url: '/pokemon/pokemon-1',
      payload: { nombre: 'Pikachu' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('updates a pokemon with PATCH', async () => {
    const updated = { ...pikachu, nivel: 8 };
    const app = await buildApp(mockEnv, createCrudClient({ data: updated }));
    const response = await app.inject({
      method: 'PATCH',
      url: '/pokemon/pokemon-1',
      payload: { nivel: 8 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
  });

  it('returns 400 when PATCH has no fields', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }));
    const response = await app.inject({
      method: 'PATCH',
      url: '/pokemon/pokemon-1',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('deletes a pokemon', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: pikachu }));
    const response = await app.inject({ method: 'DELETE', url: '/pokemon/pokemon-1' });

    expect(response.statusCode).toBe(204);
  });

  it('returns headers for HEAD /pokemon', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [pikachu] }));
    const response = await app.inject({ method: 'HEAD', url: '/pokemon' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
  });

  it('queries pokemon with QUERY', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [pikachu] }));
    const response = await app.inject({
      method: 'QUERY',
      url: '/pokemon',
      payload: { limit: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entity: 'pokemon', count: 1, data: [pikachu] });
  });
});
