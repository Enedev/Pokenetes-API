import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app';
import { PUBLIC_API_VERSION } from '../src/config/version';
import { mockEnv, createCrudClient, createInsertClient } from './helpers';

const celebi = { id: 'pokemon-7', nombre: 'Celebi', tipo: 'Psiquico', nivel: 30 };

describe('versionless /api routes', () => {
  it('lists pokemon on /api/pokemon', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [celebi] }));
    const response = await app.inject({ method: 'GET', url: '/api/pokemon' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([celebi]);
    expect(response.headers['x-api-version']).toBe(PUBLIC_API_VERSION);
  });

  it('returns the last pokemon on /api/pokemon/last', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [celebi] }));
    const response = await app.inject({ method: 'GET', url: '/api/pokemon/last' });

    expect(response.statusCode).toBe(200);
    expect(response.json().local).toEqual(celebi);
  });

  it('creates a pokemon on /api/pokemon', async () => {
    const app = await buildApp(mockEnv, createInsertClient(celebi));
    const response = await app.inject({
      method: 'POST',
      url: '/api/pokemon',
      payload: { nombre: 'Celebi', tipo: 'Psiquico', nivel: 30 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(celebi);
  });

  it('composes the peers on /api/pokemon/:id', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const app = await buildApp(mockEnv, createCrudClient({ data: celebi }), fetchImpl);
    const body = (await app.inject({ method: 'GET', url: '/api/pokemon/pokemon-7' })).json();

    expect(body.entity).toBe('pokemon');
    expect(body.local).toEqual(celebi);
    expect(body.peers).toBeDefined();
  });

  it('serves entrenador and batalla on the same prefix', async () => {
    const app = await buildApp(mockEnv, createCrudClient({ data: [] }));

    expect((await app.inject({ method: 'GET', url: '/api/entrenador' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/batalla/last' })).statusCode).toBe(200);
  });
});
