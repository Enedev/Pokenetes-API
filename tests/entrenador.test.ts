import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createInsertClient, createCrudClient } from './helpers';

const ash = {
  id: 'entrenador-1',
  nombre: 'Ash',
  region: 'Kanto',
};

describe('POST /entrenador', () => {
  it('creates an entrenador record', async () => {
    const app = await buildApp(mockEnv, createInsertClient(ash));
    const response = await app.inject({
      method: 'POST',
      url: '/entrenador',
      payload: { nombre: 'Ash', region: 'Kanto' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(ash);
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

describe('REST /entrenador', () => {
  it('lists entrenadores', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [ash] }));
    const response = await app.inject({ method: 'GET', url: '/entrenador' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([ash]);
  });

  it('returns one entrenador by id', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: ash }));
    const response = await app.inject({ method: 'GET', url: '/entrenador/entrenador-1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ash);
  });

  it('replaces an entrenador with PUT', async () => {
    const updated = { ...ash, region: 'Johto' };
    const app = await buildApp(mockEnv, createCrudClient({ data: updated }));
    const response = await app.inject({
      method: 'PUT',
      url: '/entrenador/entrenador-1',
      payload: { nombre: 'Ash', region: 'Johto' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
  });

  it('updates an entrenador with PATCH', async () => {
    const updated = { ...ash, region: 'Hoenn' };
    const app = await buildApp(mockEnv, createCrudClient({ data: updated }));
    const response = await app.inject({
      method: 'PATCH',
      url: '/entrenador/entrenador-1',
      payload: { region: 'Hoenn' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(updated);
  });

  it('deletes an entrenador', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: ash }));
    const response = await app.inject({ method: 'DELETE', url: '/entrenador/entrenador-1' });

    expect(response.statusCode).toBe(204);
  });

  it('returns headers for HEAD /entrenador', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [ash] }));
    const response = await app.inject({ method: 'HEAD', url: '/entrenador' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
  });

  it('queries entrenador with QUERY', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [ash] }));
    const response = await app.inject({
      method: 'QUERY',
      url: '/entrenador',
      payload: { limit: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ entity: 'entrenador', count: 1, data: [ash] });
  });
});
