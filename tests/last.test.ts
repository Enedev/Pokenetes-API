import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../src/app';
import { mockEnv, createCrudClient } from './helpers';

const lastPokemon = {
  id: 'pokemon-9',
  nombre: 'Mewtwo',
  tipo: 'Psiquico',
  nivel: 70,
};

describe('GET /api/v2/:entity/last', () => {
  it('returns the last local pokemon plus live peer records', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ title: 'Clean Code', author: 'Robert C. Martin' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'Hospital Central', city: 'Medellin' }),
      });

    const app = await buildApp(mockEnv, createCrudClient({ data: [lastPokemon] }), fetchImpl);
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/last' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.version).toBe('2.0.0');
    expect(body.entity).toBe('pokemon');
    expect(body.local).toEqual(lastPokemon);
    expect(body.peers['biblio-express'].live).toBe(true);
    expect(body.peers['biblio-express'].data).toEqual({
      title: 'Clean Code',
      author: 'Robert C. Martin',
    });
    expect(body.peers.hospitaline.live).toBe(true);
    expect(body.peers.hospitaline.data).toEqual({
      name: 'Hospital Central',
      city: 'Medellin',
    });
    expect(body.trace_id).toBeTruthy();
  });

  it('keeps local data when a peer is down', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const app = await buildApp(mockEnv, createCrudClient({ data: [lastPokemon] }), fetchImpl);
    const response = await app.inject({ method: 'GET', url: '/api/v2/entrenador/last' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.local).toEqual(lastPokemon);
    expect(body.peers['biblio-express'].live).toBe(false);
    expect(body.peers.hospitaline.live).toBe(false);
    expect(body.peers['biblio-express'].data).toBeNull();
  });

  it('does not treat last as an id on GET /api/v2/pokemon/last', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    const app = await buildApp(mockEnv, createCrudClient({ data: [lastPokemon] }), fetchImpl);
    const response = await app.inject({ method: 'GET', url: '/api/v2/pokemon/last' });

    expect(response.statusCode).toBe(200);
    expect(response.json().entity).toBe('pokemon');
  });
});
